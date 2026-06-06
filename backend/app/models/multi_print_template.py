from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base


class MultiPrintTemplate(Base):
    __tablename__ = "multi_print_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    items: Mapped[list["MultiPrintTemplateItem"]] = relationship(
        back_populates="template",
        cascade="all, delete-orphan",
    )
    created_by: Mapped["User | None"] = relationship()


class MultiPrintTemplateItem(Base):
    __tablename__ = "multi_print_template_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("multi_print_templates.id", ondelete="CASCADE"))

    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    archive_id: Mapped[int | None] = mapped_column(ForeignKey("print_archives.id", ondelete="SET NULL"), nullable=True)
    library_file_id: Mapped[int | None] = mapped_column(
        ForeignKey("library_files.id", ondelete="SET NULL"), nullable=True
    )
    plate_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    printer_id: Mapped[int | None] = mapped_column(ForeignKey("printers.id", ondelete="SET NULL"), nullable=True)
    target_model: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_location: Mapped[str | None] = mapped_column(String(100), nullable=True)

    ams_mapping: Mapped[str | None] = mapped_column(Text, nullable=True)
    filament_overrides: Mapped[str | None] = mapped_column(Text, nullable=True)

    scheduled_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    require_previous_success: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_off_after: Mapped[bool] = mapped_column(Boolean, default=False)
    manual_start: Mapped[bool] = mapped_column(Boolean, default=False)

    bed_levelling: Mapped[bool] = mapped_column(Boolean, default=True)
    flow_cali: Mapped[bool] = mapped_column(Boolean, default=False)
    vibration_cali: Mapped[bool] = mapped_column(Boolean, default=True)
    layer_inspect: Mapped[bool] = mapped_column(Boolean, default=False)
    timelapse: Mapped[bool] = mapped_column(Boolean, default=False)
    use_ams: Mapped[bool] = mapped_column(Boolean, default=True)
    gcode_injection: Mapped[bool] = mapped_column(Boolean, default=False)

    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    template: Mapped["MultiPrintTemplate"] = relationship(back_populates="items")
    archive: Mapped["PrintArchive | None"] = relationship()
    library_file: Mapped["LibraryFile | None"] = relationship()
    printer: Mapped["Printer | None"] = relationship()
    project: Mapped["Project | None"] = relationship()


from backend.app.models.archive import PrintArchive  # noqa: E402
from backend.app.models.library import LibraryFile  # noqa: E402
from backend.app.models.printer import Printer  # noqa: E402
from backend.app.models.project import Project  # noqa: E402
from backend.app.models.user import User  # noqa: E402
