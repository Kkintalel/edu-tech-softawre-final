from pathlib import Path
import re

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
except Exception as exc:
    raise SystemExit(f"Missing dependency: {exc}. Run: python -m pip install reportlab")

root = Path(__file__).resolve().parent
files = [
    root / 'PORTAL_USER_GUIDE.md',
    root / 'Parent-Portal-Guide.md',
    root / 'Student-Portal-Guide.md',
    root / 'Teacher-Portal-Guide.md',
    root / 'Admin-Portal-Guide.md',
    root / 'Super-Admin-Portal-Guide.md',
    root / 'School-Portal-System-Purchase-Agreement.md',
]

styles = getSampleStyleSheet()
body = ParagraphStyle('body', parent=styles['BodyText'], fontName='Helvetica', fontSize=10, leading=14, spaceAfter=6)
heading1 = ParagraphStyle('h1', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=18, leading=22, spaceAfter=12)
heading2 = ParagraphStyle('h2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=13, leading=16, spaceBefore=12, spaceAfter=8)
heading3 = ParagraphStyle('h3', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=11, leading=14, spaceBefore=8, spaceAfter=6)


def add_paragraphs(story, text):
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            story.append(Spacer(1, 4))
            continue
        if re.match(r'^#\s+', line):
            story.append(Paragraph(line[2:].strip(), heading1))
        elif re.match(r'^##\s+', line):
            story.append(Paragraph(line[3:].strip(), heading2))
        elif re.match(r'^###\s+', line):
            story.append(Paragraph(line[4:].strip(), heading3))
        elif re.match(r'^-\s+', line):
            story.append(Paragraph('• ' + line[2:].strip(), body))
        elif re.match(r'^\d+\.\s+', line):
            story.append(Paragraph(line, body))
        elif line.startswith('---'):
            story.append(Spacer(1, 6))
        else:
            story.append(Paragraph(line, body))


def build_pdf_from_md(md_path):
    output_path = md_path.with_suffix('.pdf')
    story = [Spacer(1, 4)]
    add_paragraphs(story, md_path.read_text(encoding='utf-8'))
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        rightMargin=18,
        leftMargin=18,
        topMargin=18,
        bottomMargin=18,
    )
    doc.build(story)
    return output_path

if __name__ == '__main__':
    for md in files:
        if md.exists():
            pdf = build_pdf_from_md(md)
            print(f'Created: {pdf.name}')
    print('PDF generation complete.')
