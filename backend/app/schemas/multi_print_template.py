from datetime import datetime

from pydantic import BaseModel


class MultiPrintTemplateItemCreate(BaseModel):
    label: str | None = None
    archive_id: int | None = None
    library_file_id: int | None = None
    plate_id: int | None = None
    printer_id: int | None = None
    target_model: str | None = None
    target_location: str | None = None
    ams_mapping: list[int] | None = None
    filament_overrides: list[dict] | None = None
    scheduled_time: datetime | None = None
    require_previous_success: bool = False
    auto_off_after: bool = False
    manual_start: bool = False
    bed_levelling: bool = True
    flow_cali: bool = False
    vibration_cali: bool = True
    layer_inspect: bool = False
    timelapse: bool = False
    use_ams: bool = True
    gcode_injection: bool = False
    project_id: int | None = None


class MultiPrintTemplateItemUpdate(BaseModel):
    label: str | None = None
    archive_id: int | None = None
    library_file_id: int | None = None
    plate_id: int | None = None
    printer_id: int | None = None
    target_model: str | None = None
    target_location: str | None = None
    ams_mapping: list[int] | None = None
    filament_overrides: list[dict] | None = None
    scheduled_time: datetime | None = None
    require_previous_success: bool | None = None
    auto_off_after: bool | None = None
    manual_start: bool | None = None
    bed_levelling: bool | None = None
    flow_cali: bool | None = None
    vibration_cali: bool | None = None
    layer_inspect: bool | None = None
    timelapse: bool | None = None
    use_ams: bool | None = None
    gcode_injection: bool | None = None
    project_id: int | None = None


class MultiPrintTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    items: list[MultiPrintTemplateItemCreate]


class MultiPrintTemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    items: list[MultiPrintTemplateItemUpdate] | None = None


class MultiPrintTemplateItemResponse(BaseModel):
    id: int
    template_id: int
    label: str | None
    archive_id: int | None
    library_file_id: int | None
    plate_id: int | None
    printer_id: int | None
    target_model: str | None
    target_location: str | None
    ams_mapping: list[int] | None
    filament_overrides: list[dict] | None
    scheduled_time: datetime | None
    require_previous_success: bool
    auto_off_after: bool
    manual_start: bool
    bed_levelling: bool
    flow_cali: bool
    vibration_cali: bool
    layer_inspect: bool
    timelapse: bool
    use_ams: bool
    gcode_injection: bool
    project_id: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MultiPrintTemplateResponse(BaseModel):
    id: int
    name: str
    description: str | None
    created_by_id: int | None
    created_at: datetime
    updated_at: datetime
    last_run_at: datetime | None
    items: list[MultiPrintTemplateItemResponse]

    class Config:
        from_attributes = True


class MultiPrintTemplateRunRequest(BaseModel):
    scheduled_time: datetime | None = None
    override_printer_id: int | None = None
    override_target_model: str | None = None


class MultiPrintTemplateRunError(BaseModel):
    index: int
    reason: str


class MultiPrintTemplateRunResponse(BaseModel):
    created_queue_ids: list[int]
    failed_items: list[MultiPrintTemplateRunError]