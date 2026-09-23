#!/usr/bin/env python3
import json
import os
import re
import sys
from io import BytesIO
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION_START
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "deliverables" / "aidreamcapes-eu-video-prompt-pack-2026-09"
MANIFEST_PATH = PACK / "asset-manifest.json"
REPORT_PATH = PACK / "supplier-run-report.json"
OUTPUT_PATH = PACK / "Aidreamcapes_EU_Video_Prompt_Pack_Seedance_2_5.docx"


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default


manifest = load_json(MANIFEST_PATH, {})
supplier_report = load_json(REPORT_PATH, {"report": []})
report_entries = supplier_report.get("report", [])
report_by_key = {}
for item in report_entries:
    key = (str(item.get("theme")), str(item.get("asset")))
    # Keep the last concrete result, but do not let a later skipped_existing
    # record hide a previous succeeded/failed result.
    if item.get("status") in ("succeeded", "failed") or key not in report_by_key:
        report_by_key[key] = item


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color="D9D9D9", sz="6"):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), sz)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=90, start=100, bottom=90, end=100):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    for row in table.rows:
        for cell in row.cells:
            set_cell_border(cell)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = paragraph.add_run("Aidreamcapes EU · Seedance 2.5 · ")
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(100, 100, 100)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def set_run_font(run, name="Aptos", size=10.5, bold=False, color="000000", italic=False):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), "PingFang SC")
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def add_body(doc, text, size=10.5, bold=False, italic=False, color="000000", space_after=4, keep=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.08
    p.paragraph_format.keep_with_next = keep
    run = p.add_run(str(text))
    set_run_font(run, size=size, bold=bold, italic=italic, color=color)
    return p


def add_label_value(doc, label, value):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(f"{label} ")
    set_run_font(run, size=10.5, bold=True)
    run = p.add_run(str(value))
    set_run_font(run, size=10.5)
    return p


def add_prompt_block(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Inches(0.18)
    p.paragraph_format.right_indent = Inches(0.12)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.0
    for index, line in enumerate(str(text).splitlines()):
        run = p.add_run(line)
        set_run_font(run, name="Aptos Mono", size=8.5)
        if index < len(str(text).splitlines()) - 1:
            run.add_break()
    return p


def add_heading(doc, text, level=1, page_break=False):
    p = doc.add_heading(str(text), level=level)
    p.paragraph_format.keep_with_next = True
    if page_break:
        p.paragraph_format.page_break_before = True
    for run in p.runs:
        set_run_font(run, size={1: 17, 2: 14, 3: 11.5}.get(level, 10.5), bold=True)
    return p


def add_asset_image(doc, asset):
    display_path = PACK / asset.get("displayPath", "")
    if not display_path.exists():
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        run = p.add_run("Preview not generated: " + asset.get("displayPath", ""))
        set_run_font(run, size=9, italic=True, color="7A1F1F")
        return False
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(3)
    width = 2.9 if asset.get("orientation") == "portrait" else 3.35
    try:
        # Supplier display derivatives can use JPEG encodings that LibreOffice
        # and python-docx do not consistently parse. Normalize in memory for
        # the DOCX only; the original supplier files remain untouched.
        with Image.open(display_path) as source:
            normalized = source.convert("RGB")
            buffer = BytesIO()
            normalized.save(buffer, format="PNG", optimize=True)
            buffer.seek(0)
            p.add_run().add_picture(buffer, width=Inches(width))
    except Exception:
        # Keep the copyable prompts even if a provider display derivative is
        # unreadable or incomplete; do not re-request paid assets here.
        run = p.add_run("Preview unreadable")
        set_run_font(run, size=9, italic=True, color="7A1F1F")
    caption = doc.add_paragraph()
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption.paragraph_format.space_after = Pt(8)
    run = caption.add_run(f"{asset.get('id')} · {asset.get('name')} · {asset.get('type')}")
    set_run_font(run, size=8.5, color="666666", italic=True)
    return True


def add_inventory_table(doc, themes):
    table = doc.add_table(rows=1, cols=6)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = True
    headers = ["No.", "Topic", "Category", "Homepage", "Ratio", "Assets"]
    for cell, header in zip(table.rows[0].cells, headers):
        set_cell_shading(cell, "1F4E79")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(header)
        set_run_font(run, size=9, bold=True, color="FFFFFF")
    set_repeat_table_header(table.rows[0])
    for index, theme in enumerate(themes, 1):
        cells = table.add_row().cells
        values = [str(index), theme.get("labelFr", ""), theme.get("categoryFr", ""), "Yes" if theme.get("homepagePriority") else "No", theme.get("videoAspectRatio", ""), str(theme.get("assetCount", ""))]
        for col, (cell, value) in enumerate(zip(cells, values)):
            if index % 2 == 0:
                set_cell_shading(cell, "F3F6F9")
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col in (0, 3, 4, 5) else WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(value)
            set_run_font(run, size=8.5)
    set_table_borders(table)
    return table


def add_asset_table(doc, assets):
    table = doc.add_table(rows=1, cols=4)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Reference", "Type", "Role", "Preview path"]
    for cell, header in zip(table.rows[0].cells, headers):
        set_cell_shading(cell, "5B9BD5")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(header)
        set_run_font(run, size=8.5, bold=True, color="FFFFFF")
    set_repeat_table_header(table.rows[0])
    for index, asset in enumerate(assets):
        cells = table.add_row().cells
        values = [asset.get("id", ""), asset.get("type", ""), asset.get("role", ""), asset.get("displayPath", "")]
        for col, (cell, value) in enumerate(zip(cells, values)):
            if index % 2 == 1:
                set_cell_shading(cell, "F3F6F9")
            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            run = p.add_run(value)
            set_run_font(run, size=8.2, name="Aptos Mono" if col == 3 else "Aptos")
    set_table_borders(table)
    return table


def build_document():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.65)
    section.bottom_margin = Inches(0.65)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos")
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(0, 0, 0)
    for style_name, size in (("Title", 23), ("Heading 1", 17), ("Heading 2", 14), ("Heading 3", 11.5)):
        style = styles[style_name]
        style.font.name = "Aptos Display" if style_name != "Heading 3" else "Aptos"
        style._element.rPr.rFonts.set(qn("w:eastAsia"), style.font.name)
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
    code_style = styles.add_style("Prompt Text", WD_STYLE_TYPE.PARAGRAPH)
    code_style.font.name = "Aptos Mono"
    code_style._element.rPr.rFonts.set(qn("w:eastAsia"), "Aptos Mono")
    code_style.font.size = Pt(8.5)
    code_style.font.color.rgb = RGBColor(0, 0, 0)

    footer = section.footer.paragraphs[0]
    add_page_number(footer)

    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(8)
    run = title.add_run("Aidreamcapes EU Video Prompt Pack")
    set_run_font(run, name="Aptos Display", size=23, bold=True)
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(18)
    run = subtitle.add_run("Seedance 2.5 · 30 Second Prompts · French Topic Labels")
    set_run_font(run, size=12, color="404040")
    add_body(doc, "Each topic includes its own asset previews, image prompts, and a copy-ready English Seedance 2.5 video prompt. Use only the @Image references listed in that topic.", size=11, space_after=6)
    add_body(doc, "Video: 30 seconds · Images: image4 / gpt-image-2 · Prompt: English · Topic labels: Français", size=10, color="555555", space_after=0)

    themes = manifest.get("themes", [])

    for entry in themes:
        add_heading(doc, f"{entry.get('order')}. {entry.get('labelFr')}", level=1, page_break=entry.get("order") != 1)
        add_body(doc, f"{entry.get('categoryFr', '')} · {entry.get('videoAspectRatio', '')} · Homepage: {'Yes' if entry.get('homepagePriority') else 'No'}", size=9.5, color="555555", space_after=3)
        add_body(doc, entry.get("concept", ""), size=10, color="333333", space_after=8)
        for asset in entry.get("assets", []):
            add_heading(doc, f"{asset.get('id')} · {asset.get('name')}", level=3)
            status = report_by_key.get((entry.get("slug"), asset.get("id")), {})
            status_text = status.get("status", "not_started")
            if status_text == "succeeded":
                add_body(doc, "Asset image: generated for this topic", size=9, color="245B36", space_after=2)
            elif status_text == "failed":
                add_body(doc, "Asset image: supplier generation failed; the video prompt below remains copy-ready.", size=9, color="7A1F1F", space_after=2)
            else:
                add_body(doc, "Asset image: not generated.", size=9, color="7A5B00", space_after=2)
            add_asset_image(doc, asset)
            add_body(doc, "Asset image prompt", size=9.5, bold=True, space_after=2)
            add_prompt_block(doc, asset.get("prompt", ""))
        add_heading(doc, "Seedance 2.5 Video Prompt — Copy", level=2)
        add_prompt_block(doc, entry.get("videoPrompt", ""))

    doc.core_properties.title = "Aidreamcapes EU Video Prompt Pack Seedance 2.5"
    doc.core_properties.subject = "21 French video topics with supplier-generated visual assets and Seedance prompts"
    doc.core_properties.author = "Aidreamcapes EU Creative Production"
    doc.core_properties.keywords = "Aidreamcapes, Seedance 2.5, video prompts, image assets"
    PACK.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT_PATH)
    print(json.dumps({"ok": True, "output": str(OUTPUT_PATH), "themes": len(themes), "embeddedExistingAssets": sum(1 for entry in themes for asset in entry.get("assets", []) if (PACK / asset.get("displayPath", "")).exists())}, ensure_ascii=False))


if __name__ == "__main__":
    build_document()
