import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.auth import RequirePermissionIfAuthEnabled
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.core.permissions import Permission
from backend.app.models.archive import PrintArchive
from backend.app.models.library import LibraryFile
from backend.app.models.multi_print_template import MultiPrintTemplate, MultiPrintTemplateItem
from backend.app.models.print_queue import PrintQueueItem
from backend.app.models.printer import Printer
from backend.app.models.user import User
from backend.app.schemas.multi_print_template import (
    MultiPrintTemplateCreate,
    MultiPrintTemplateItemResponse,
    MultiPrintTemplateResponse,
    MultiPrintTemplateRunRequest,
    MultiPrintTemplateRunResponse,
    MultiPrintTemplateUpdate,
)
from backend.app.utils.threemf_tools import extract_filament_usage_from_3mf

router = APIRouter(prefix="/multi-print-templates", tags=["multi-print-templates"])
logger = logging.getLogger(__name__)


def _decode_json_list(value: str | None) -> list | None:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _serialize_item(item: MultiPrintTemplateItem) -> MultiPrintTemplateItemResponse:
    return MultiPrintTemplateItemResponse(
        id=item.id,
        template_id=item.template_id,
        label=item.label,
        archive_id=item.archive_id,
        library_file_id=item.library_file_id,
        plate_id=item.plate_id,
        printer_id=item.printer_id,
        target_model=item.target_model,
        target_location=item.target_location,
        ams_mapping=_decode_json_list(item.ams_mapping),
        filament_overrides=_decode_json_list(item.filament_overrides),
        scheduled_time=item.scheduled_time,
        require_previous_success=item.require_previous_success,
        auto_off_after=item.auto_off_after,
        manual_start=item.manual_start,
        bed_levelling=item.bed_levelling,
        flow_cali=item.flow_cali,
        vibration_cali=item.vibration_cali,
        layer_inspect=item.layer_inspect,
        timelapse=item.timelapse,
        use_ams=item.use_ams,
        gcode_injection=item.gcode_injection,
        project_id=item.project_id,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _serialize_template(template: MultiPrintTemplate) -> MultiPrintTemplateResponse:
    items = [_serialize_item(item) for item in template.items]
    return MultiPrintTemplateResponse(
        id=template.id,
        name=template.name,
        description=template.description,
        created_by_id=template.created_by_id,
        created_at=template.created_at,
        updated_at=template.updated_at,
        last_run_at=template.last_run_at,
        items=items,
    )


def _validate_item_source(archive_id: int | None, library_file_id: int | None) -> None:
    if bool(archive_id) == bool(library_file_id):
        raise HTTPException(400, "Each item must specify exactly one of archive_id or library_file_id")


def _normalize_json_list(value: str | list | None) -> list | None:
    if value is None:
        return None
    if isinstance(value, list):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _resolve_file_path(archive: PrintArchive | None, library_file: LibraryFile | None) -> Path | None:
    if archive:
        return settings.base_dir / archive.file_path
    if library_file:
        lib_path = Path(library_file.file_path)
        return lib_path if lib_path.is_absolute() else settings.base_dir / library_file.file_path
    return None


def _validate_printer_target(printer_id: int | None, target_model: str | None) -> None:
    if printer_id is not None and target_model is not None:
        raise HTTPException(400, "Cannot specify both printer_id and target_model")


def _validate_plate_and_ams(file_path: Path | None, plate_id: int | None, ams_mapping: list | None) -> None:
    if plate_id is not None and plate_id < 1:
        raise HTTPException(400, "plate_id must be >= 1")

    if file_path is None or not file_path.exists():
        return

    all_filaments = extract_filament_usage_from_3mf(file_path)
    plate_filaments = (
        extract_filament_usage_from_3mf(file_path, plate_id)
        if plate_id is not None
        else all_filaments
    )

    if plate_id is not None and all_filaments and not plate_filaments:
        raise HTTPException(400, f"Invalid plate_id {plate_id}")

    if ams_mapping is None:
        return

    max_slot = 0
    for filament in plate_filaments:
        slot_id = filament.get("slot_id")
        if isinstance(slot_id, int) and slot_id > max_slot:
            max_slot = slot_id

    if max_slot and len(ams_mapping) < max_slot:
        raise HTTPException(400, "ams_mapping length is smaller than the required filament slots")


async def _validate_item_details(
    db: AsyncSession,
    archive_id: int | None,
    library_file_id: int | None,
    printer_id: int | None,
    target_model: str | None,
    plate_id: int | None,
    ams_mapping: str | list | None,
) -> None:
    _validate_item_source(archive_id, library_file_id)
    _validate_printer_target(printer_id, target_model)

    archive = None
    library_file = None
    if archive_id is not None:
        result = await db.execute(select(PrintArchive).where(PrintArchive.id == archive_id))
        archive = result.scalar_one_or_none()
        if not archive:
            raise HTTPException(400, f"Archive not found: {archive_id}")
    if library_file_id is not None:
        result = await db.execute(LibraryFile.active().where(LibraryFile.id == library_file_id))
        library_file = result.scalar_one_or_none()
        if not library_file:
            raise HTTPException(400, f"Library file not found: {library_file_id}")
    if printer_id is not None:
        result = await db.execute(select(Printer).where(Printer.id == printer_id))
        if not result.scalar_one_or_none():
            raise HTTPException(400, f"Printer not found: {printer_id}")

    file_path = _resolve_file_path(archive, library_file)
    _validate_plate_and_ams(file_path, plate_id, _normalize_json_list(ams_mapping))


@router.get("/", response_model=list[MultiPrintTemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    _: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_READ),
):
    result = await db.execute(
        select(MultiPrintTemplate)
        .options(selectinload(MultiPrintTemplate.items))
        .order_by(MultiPrintTemplate.name)
    )
    templates = result.scalars().all()
    return [_serialize_template(template) for template in templates]


@router.get("/{template_id}", response_model=MultiPrintTemplateResponse)
async def get_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    _: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_READ),
):
    result = await db.execute(
        select(MultiPrintTemplate)
        .where(MultiPrintTemplate.id == template_id)
        .options(selectinload(MultiPrintTemplate.items))
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")
    return _serialize_template(template)


@router.post("/", response_model=MultiPrintTemplateResponse)
async def create_template(
    payload: MultiPrintTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_CREATE),
):
    if not payload.items:
        raise HTTPException(400, "Template must include at least one item")

    for item in payload.items:
        await _validate_item_details(
            db,
            item.archive_id,
            item.library_file_id,
            item.printer_id,
            item.target_model,
            item.plate_id,
            item.ams_mapping,
        )

    template = MultiPrintTemplate(
        name=payload.name,
        description=payload.description,
        created_by_id=current_user.id if current_user else None,
    )
    db.add(template)
    await db.flush()

    for item in payload.items:
        db.add(
            MultiPrintTemplateItem(
                template_id=template.id,
                label=item.label,
                archive_id=item.archive_id,
                library_file_id=item.library_file_id,
                plate_id=item.plate_id,
                printer_id=item.printer_id,
                target_model=item.target_model,
                target_location=item.target_location,
                ams_mapping=json.dumps(item.ams_mapping) if item.ams_mapping is not None else None,
                filament_overrides=json.dumps(item.filament_overrides)
                if item.filament_overrides is not None
                else None,
                scheduled_time=item.scheduled_time,
                require_previous_success=item.require_previous_success,
                auto_off_after=item.auto_off_after,
                manual_start=item.manual_start,
                bed_levelling=item.bed_levelling,
                flow_cali=item.flow_cali,
                vibration_cali=item.vibration_cali,
                layer_inspect=item.layer_inspect,
                timelapse=item.timelapse,
                use_ams=item.use_ams,
                gcode_injection=item.gcode_injection,
                project_id=item.project_id,
            )
        )

    await db.commit()

    result = await db.execute(
        select(MultiPrintTemplate)
        .where(MultiPrintTemplate.id == template.id)
        .options(selectinload(MultiPrintTemplate.items))
    )
    template = result.scalar_one()
    logger.info(
        "multi_print_template.create template_id=%s user_id=%s item_count=%s",
        template.id,
        current_user.id if current_user else None,
        len(template.items),
    )
    return _serialize_template(template)


@router.patch("/{template_id}", response_model=MultiPrintTemplateResponse)
async def update_template(
    template_id: int,
    payload: MultiPrintTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_UPDATE_ALL),
):
    result = await db.execute(
        select(MultiPrintTemplate)
        .where(MultiPrintTemplate.id == template_id)
        .options(selectinload(MultiPrintTemplate.items))
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    if payload.name is not None:
        template.name = payload.name
    if payload.description is not None:
        template.description = payload.description

    if payload.items is not None:
        for item in payload.items:
            await _validate_item_details(
                db,
                item.archive_id,
                item.library_file_id,
                item.printer_id,
                item.target_model,
                item.plate_id,
                item.ams_mapping,
            )
        template.items.clear()
        await db.flush()
        for item in payload.items:
            template.items.append(
                MultiPrintTemplateItem(
                    template_id=template.id,
                    label=item.label,
                    archive_id=item.archive_id,
                    library_file_id=item.library_file_id,
                    plate_id=item.plate_id,
                    printer_id=item.printer_id,
                    target_model=item.target_model,
                    target_location=item.target_location,
                    ams_mapping=json.dumps(item.ams_mapping) if item.ams_mapping is not None else None,
                    filament_overrides=json.dumps(item.filament_overrides)
                    if item.filament_overrides is not None
                    else None,
                    scheduled_time=item.scheduled_time,
                    require_previous_success=item.require_previous_success
                    if item.require_previous_success is not None
                    else False,
                    auto_off_after=item.auto_off_after if item.auto_off_after is not None else False,
                    manual_start=item.manual_start if item.manual_start is not None else False,
                    bed_levelling=item.bed_levelling if item.bed_levelling is not None else True,
                    flow_cali=item.flow_cali if item.flow_cali is not None else False,
                    vibration_cali=item.vibration_cali if item.vibration_cali is not None else True,
                    layer_inspect=item.layer_inspect if item.layer_inspect is not None else False,
                    timelapse=item.timelapse if item.timelapse is not None else False,
                    use_ams=item.use_ams if item.use_ams is not None else True,
                    gcode_injection=item.gcode_injection if item.gcode_injection is not None else False,
                    project_id=item.project_id,
                )
            )

    await db.commit()
    await db.refresh(template)
    logger.info(
        "multi_print_template.update template_id=%s user_id=%s item_count=%s",
        template.id,
        current_user.id if current_user else None,
        len(template.items),
    )
    return _serialize_template(template)


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_UPDATE_ALL),
):
    result = await db.execute(select(MultiPrintTemplate).where(MultiPrintTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    await db.delete(template)
    await db.commit()
    logger.info(
        "multi_print_template.delete template_id=%s user_id=%s",
        template_id,
        current_user.id if current_user else None,
    )
    return {"message": "Template deleted"}


@router.post("/{template_id}/run", response_model=MultiPrintTemplateRunResponse)
async def run_template(
    template_id: int,
    payload: MultiPrintTemplateRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = RequirePermissionIfAuthEnabled(Permission.QUEUE_CREATE),
):
    result = await db.execute(
        select(MultiPrintTemplate)
        .where(MultiPrintTemplate.id == template_id)
        .options(selectinload(MultiPrintTemplate.items))
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    created_ids: list[int] = []
    failed_items: list[dict] = []

    for index, item in enumerate(template.items):
        try:
            async with db.begin_nested():
                await _validate_item_details(
                    db,
                    item.archive_id,
                    item.library_file_id,
                    item.printer_id,
                    item.target_model,
                    item.plate_id,
                    item.ams_mapping,
                )

                effective_printer_id = payload.override_printer_id
                effective_target_model = payload.override_target_model

                if effective_printer_id is None and effective_target_model is None:
                    effective_printer_id = item.printer_id
                    effective_target_model = item.target_model

                _validate_printer_target(effective_printer_id, effective_target_model)

                if effective_printer_id is not None:
                    result = await db.execute(select(Printer).where(Printer.id == effective_printer_id))
                    if not result.scalar_one_or_none():
                        raise HTTPException(400, f"Printer not found: {effective_printer_id}")

                if effective_printer_id is not None:
                    position_result = await db.execute(
                        select(func.max(PrintQueueItem.position))
                        .where(PrintQueueItem.printer_id == effective_printer_id)
                        .where(PrintQueueItem.status == "pending")
                    )
                else:
                    position_result = await db.execute(
                        select(func.max(PrintQueueItem.position))
                        .where(PrintQueueItem.printer_id.is_(None))
                        .where(PrintQueueItem.status == "pending")
                    )
                next_position = (position_result.scalar() or 0) + 1

                queue_item = PrintQueueItem(
                    printer_id=effective_printer_id,
                    target_model=effective_target_model,
                    target_location=item.target_location,
                    required_filament_types=None,
                    filament_overrides=item.filament_overrides,
                    archive_id=item.archive_id,
                    library_file_id=item.library_file_id,
                    scheduled_time=payload.scheduled_time or item.scheduled_time,
                    require_previous_success=item.require_previous_success,
                    auto_off_after=item.auto_off_after,
                    manual_start=item.manual_start,
                    ams_mapping=item.ams_mapping,
                    plate_id=item.plate_id,
                    bed_levelling=item.bed_levelling,
                    flow_cali=item.flow_cali,
                    vibration_cali=item.vibration_cali,
                    layer_inspect=item.layer_inspect,
                    timelapse=item.timelapse,
                    use_ams=item.use_ams,
                    gcode_injection=item.gcode_injection,
                    project_id=item.project_id,
                    position=next_position,
                    status="pending",
                )
                db.add(queue_item)
                await db.flush()
                created_ids.append(queue_item.id)
        except HTTPException as exc:
            failed_items.append({"index": index, "reason": exc.detail})
        except Exception as exc:
            failed_items.append({"index": index, "reason": str(exc)})

    template.last_run_at = func.now()
    await db.commit()
    logger.info(
        "multi_print_template.run template_id=%s user_id=%s created=%s failed=%s",
        template.id,
        current_user.id if current_user else None,
        len(created_ids),
        len(failed_items),
    )

    return MultiPrintTemplateRunResponse(
        created_queue_ids=created_ids,
        failed_items=failed_items,
    )