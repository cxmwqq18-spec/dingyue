#!/usr/bin/env python3
import json
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageOps
from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "deliverables" / "aidreamcapes-eu-video-prompt-pack-2026-09"
MANIFEST_PATH = PACK / "asset-manifest.json"
OUTPUT_PATH = PACK / "Aidreamcapes_EU_Video_Prompt_Pack_Seedance_2_5.docx"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


manifest = load_json(MANIFEST_PATH)


def set_run(run, font="Arial", size=10.5, bold=False, italic=False, color="000000"):
    run.font.name = font
    run._element.rPr.rFonts.set(qn("w:ascii"), font)
    run._element.rPr.rFonts.set(qn("w:hAnsi"), font)
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    run.font.size = Pt(size)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = RGBColor.from_string(color)


def set_cell_margins(cell, top=0, start=80, bottom=0, end=80):
    tc_pr = cell._tc.get_or_add_tcPr()
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


def remove_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "nil")


def add_page_field(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run("30-second theme prompts · Page ")
    set_run(run, size=9, color="7B8188")
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    separate = OxmlElement("w:fldChar")
    separate.set(qn("w:fldCharType"), "separate")
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    field_run = paragraph.add_run()
    set_run(field_run, size=9, color="7B8188")
    field_run._r.append(begin)
    field_run._r.append(instr)
    field_run._r.append(separate)
    field_run._r.append(end)


def configure_header_footer(section):
    header = section.header.paragraphs[0]
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header.paragraph_format.space_after = Pt(0)
    run = header.add_run("Aidreamcapes EU · Seedance 2.5")
    set_run(run, size=9, color="7B8188")
    add_page_field(section.footer.paragraphs[0])


def add_square_image(cell, asset):
    display_path = PACK / asset.get("displayPath", "")
    p = cell.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(1)
    if display_path.exists():
        with Image.open(display_path) as source:
            source = ImageOps.exif_transpose(source).convert("RGB")
            square = ImageOps.contain(source, (720, 720), method=Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", (720, 720), (245, 245, 245))
            canvas.paste(square, ((720 - square.width) // 2, (720 - square.height) // 2))
            buffer = BytesIO()
            canvas.save(buffer, format="PNG", optimize=True)
            buffer.seek(0)
            p.add_run().add_picture(buffer, width=Inches(1.95), height=Inches(1.95))
    else:
        run = p.add_run("No image returned")
        set_run(run, size=8.5, color="9AA0A6", italic=True)


def add_caption(cell, index, asset):
    p = cell.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(f"@img{index} · {asset.get('name', '')} · {asset.get('type', '')}")
    set_run(run, size=8.5, color="7B8188")


def add_asset_grid(doc, assets):
    if not assets:
        return
    columns = 3
    rows = (len(assets) + columns - 1) // columns
    table = doc.add_table(rows=rows, cols=columns)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    remove_table_borders(table)
    for row in table.rows:
        for cell in row.cells:
            cell.width = Inches(2.35)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            set_cell_margins(cell)
    for index, asset in enumerate(assets, start=1):
        cell = table.cell((index - 1) // columns, (index - 1) % columns)
        add_square_image(cell, asset)
        add_caption(cell, index, asset)
    for index in range(len(assets), rows * columns):
        table.cell(index // columns, index % columns).text = ""
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(1)


def extract_block(blocks, starts_with):
    for block in blocks:
        if block.lower().startswith(starts_with.lower()):
            return block
    return ""


def strip_label(text, label):
    if text.lower().startswith(label.lower()):
        return text[len(label):].strip()
    return text.strip()


def prompt_paragraphs(entry, assets):
    raw = entry.get("videoPrompt", "")
    blocks = [block.strip() for block in raw.split("\n\n") if block.strip()]
    create_block = next((block for block in blocks if block.startswith("Create a 30-second")), "")
    timeline_block = extract_block(blocks, "Timeline and shot direction:")
    camera_block = extract_block(blocks, "Camera and image language:")
    lighting_block = extract_block(blocks, "Lighting and color:")
    audio_block = extract_block(blocks, "Audio:")
    final_block = extract_block(blocks, "Final image:")
    negative_block = extract_block(blocks, "Negative constraints:")

    refs = ", ".join(f"@img{i}" for i in range(1, len(assets) + 1))
    subject = "Use the attached topic assets in this order: " + refs + ". " if refs else "Use the written description without reference images. "
    subject += create_block.replace("Create a ", "Create a ", 1)
    action = strip_label(timeline_block, "Timeline and shot direction:")
    scene = entry.get("concept", "")
    camera = strip_label(camera_block, "Camera and image language:")
    lighting = strip_label(lighting_block, "Lighting and color:")
    audio = strip_label(audio_block, "Audio:")
    final = "Keep attached subjects, props, scale, light direction and screen direction consistent; no identity drift or random montage. Final frame: " + strip_label(final_block, "Final image:")
    negative = strip_label(negative_block, "Negative constraints:")

    ratio = entry.get("videoAspectRatio", "16:9")
    duration = f"Exactly 30 seconds in one Seedance 2.5 generation, {ratio} aspect ratio, 1080p delivery target; use the attached independent topic assets as visual references and keep all action physically continuous."
    return [
        ("Subject / Character", subject),
        ("Action / Motion", action),
        ("Scene / Environment", scene),
        ("Camera / Shot / Lens", camera),
        ("Lighting / Atmosphere", lighting),
        ("Sound / Audio", audio),
        ("Duration / Aspect Ratio / Resolution", duration),
        ("Continuity / Final Frame", final),
        ("Negative Constraints", negative),
    ]


def add_prompt_block(doc, entry, assets):
    heading = doc.add_paragraph()
    heading.paragraph_format.space_before = Pt(2)
    heading.paragraph_format.space_after = Pt(7)
    run = heading.add_run("COPY-READY SEEDANCE 2.5 PROMPT")
    set_run(run, font="Arial", size=14, bold=True, color="009DB5")
    for label, body in prompt_paragraphs(entry, assets):
        if not body:
            continue
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 0.95
        lead = p.add_run(f"{label}: ")
        set_run(lead, font="Consolas", size=8.6, bold=True)
        content = p.add_run(body.replace("@image", "@img"))
        set_run(content, font="Consolas", size=8.6)


def build_document():
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.65)
    section.bottom_margin = Inches(0.60)
    section.left_margin = Inches(0.65)
    section.right_margin = Inches(0.65)
    configure_header_footer(section)

    normal = doc.styles["Normal"]
    normal.font.name = "Consolas"
    normal._element.rPr.rFonts.set(qn("w:ascii"), "Consolas")
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), "Consolas")
    normal.font.size = Pt(9.5)

    themes = manifest.get("themes", [])

    cover_brand = doc.add_paragraph()
    cover_brand.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cover_brand.paragraph_format.space_before = Pt(135)
    cover_brand.paragraph_format.space_after = Pt(8)
    run = cover_brand.add_run("AIDREAMCAPES EU")
    set_run(run, font="Arial", size=13, bold=True, color="009DB5")

    cover_title = doc.add_paragraph()
    cover_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cover_title.paragraph_format.space_after = Pt(20)
    cover_title.paragraph_format.line_spacing = 0.9
    run = cover_title.add_run("Seedance 2.5\n21 Theme Prompts")
    set_run(run, font="Arial", size=28, bold=True)

    cover_meta = doc.add_paragraph()
    cover_meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cover_meta.paragraph_format.space_after = Pt(22)
    run = cover_meta.add_run("30 seconds each · 21 themes · copy-ready prompts")
    set_run(run, font="Arial", size=12, color="7B8188")

    cover_note = doc.add_paragraph()
    cover_note.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = cover_note.add_run("Images are grouped by theme. Copy each prompt block directly into Seedance 2.5.")
    set_run(run, font="Arial", size=10.5, italic=True, color="7B8188")

    for index, entry in enumerate(themes):
        title = doc.add_paragraph()
        title.paragraph_format.page_break_before = True
        title.paragraph_format.space_after = Pt(10)
        title.paragraph_format.keep_with_next = True
        run = title.add_run(f"{int(entry.get('order', index + 1)):02d} · {entry.get('labelFr', '')}")
        set_run(run, font="Arial", size=23, bold=True)

        assets = [
            asset for asset in entry.get("assets", [])
            if (PACK / asset.get("displayPath", "")).exists()
        ]
        add_asset_grid(doc, assets)
        add_prompt_block(doc, entry, assets)

    doc.core_properties.title = "Seedance 2.5 21 Theme Prompts"
    doc.core_properties.subject = "Aidreamcapes EU copy-ready video prompts with topic asset references"
    doc.core_properties.author = "Aidreamcapes EU Creative Production"
    doc.core_properties.keywords = "Seedance 2.5, Aidreamcapes EU, video prompts, image references"
    PACK.mkdir(parents=True, exist_ok=True)
    doc.save(OUTPUT_PATH)
    print(json.dumps({"ok": True, "output": str(OUTPUT_PATH), "themes": len(themes), "embeddedImages": sum(1 for entry in themes for asset in entry.get("assets", []) if (PACK / asset.get("displayPath", "")).exists())}, ensure_ascii=False))


if __name__ == "__main__":
    build_document()
