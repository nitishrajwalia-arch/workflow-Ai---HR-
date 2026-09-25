"""
Build the master sheet Bulk intake accepts.

One workbook, two jobs: adding people who are not on the roster, and filling in
blanks for people who are. The column names are EXACTLY the ones the importer
matches on, so nothing has to be renamed on the way in.

Three rules the sheet is built around, each learned from a real import:

  1. NO EXAMPLE ROWS IN THE DATA SHEETS. A sample row of invented employees is
     precisely the thing that gets imported by accident. The example lives on
     the instructions sheet, where it cannot be uploaded.
  2. DATES ARE TEXT. A date cell comes out of Excel as a serial number, and a
     serial number read as a date is how somebody is born in 1905. The columns
     are formatted as text and the sheet asks for "12 Aug 2026".
  3. A BLANK CELL MEANS "not answered", never "clear it" — which is what the
     importer does, and what the sheet says at the top of the second tab.

    python3 scripts/make-intake-sheet.py [out.xlsx]
"""
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/Marbella-Bulk-Intake-Master.xlsx'

INK = '1B3A63'
GOLD = 'B08D3F'
PAPER = 'F4F1EA'
LINE = 'D9D2C4'

DEPARTMENTS = ['Accounts', 'Admin', 'CRM', 'HR', 'Horticulture', 'IT', 'Maintenance',
               'Marketing', 'Pantry', 'Project', 'Purchase', 'Sales']
SITES = ['Marbella Grand', 'Twin Tower', 'Marbella Royce', 'New Marbella']
COMPANIES = ['SRG Developers & Promoters', 'SRG Marbella Developers And Promoters LLP',
             'Garg Builders And Promoters LLP', 'New Marbella Developers And Promoters LLP']
TYPES = ['Staff', 'Site']
GENDERS = ['Male', 'Female', 'Other', 'Prefers not to say']

# Exactly the columns the importer matches, in the order it lists them.
# (header, width, required, note)
NEW_COLUMNS = [
    ('Employee Name',   26, True,  'As it should appear on the ID card.'),
    ('Employee ID',     14, False, 'Leave blank and the system issues the next one for that department.'),
    ('Designation',     24, True,  'Their role — Mason, Site Engineer, Accountant.'),
    ('Department',      16, True,  'Pick from the list.'),
    ('Site',            18, False, 'Where they work. Pick from the list. Blank means Marbella Grand.'),
    ('Date of Joining', 16, True,  'Type it as 12 Aug 2026. Do not let Excel turn it into a date.'),
    ('Date of Birth',   16, False, 'Same format. Blank is fine — it can be filled in later.'),
    ('Gender',          14, False, 'Pick from the list, or leave blank if nobody has asked.'),
    ('Personal Mobile', 18, True,  'Their own number, 10 digits. Not the company number.'),
    ('Personal Email',  26, False, 'Their own email. A company address is refused — it dies with the account.'),
    ('Basic',           12, False, 'Rupees a month. Leave the three pay columns blank unless you have been told the split.'),
    ('HRA',             12, False, 'Rupees a month.'),
    ('Other Allowances',16, False, 'Rupees a month.'),
    ('Device IMEI',     20, False, 'Only if the company has issued them a handset.'),
    ('Official Number', 18, False, 'The company SIM, if they have one.'),
]

FILL_COLUMNS = [
    ('Employee ID',     14, True,  'The only column that must be filled. Every row is matched on it.'),
    ('Employee Name',   26, False, 'Not read — it is here so you can see whose row you are on.'),
    ('Date of Birth',   16, False, 'Type it as 12 Aug 2026.'),
    ('Gender',          14, False, 'Pick from the list.'),
    ('Personal Mobile', 18, False, 'Their own number, 10 digits.'),
    ('Personal Email',  26, False, 'Their own email, not the company one.'),
    ('Reports To',      16, False, 'The employee ID of their manager, e.g. MB-PRJ-0014.'),
    ('Device IMEI',     20, False, 'Only if a handset has been issued.'),
    ('Official Number', 18, False, 'The company SIM, if they have one.'),
]


def head(ws, columns, start_row):
    """The header row the importer reads, plus a note row above it."""
    for i, (name, width, req, note) in enumerate(columns, start=1):
        letter = get_column_letter(i)
        ws.column_dimensions[letter].width = width

        note_cell = ws.cell(row=start_row - 1, column=i, value=note)
        note_cell.font = Font(name='Calibri', size=8, color='7A6E5A', italic=True)
        note_cell.alignment = Alignment(wrap_text=True, vertical='bottom')

        cell = ws.cell(row=start_row, column=i, value=name)
        cell.font = Font(name='Calibri', size=11, bold=True, color='FFFFFF')
        cell.fill = PatternFill('solid', fgColor=INK if req else '4A6A96')
        cell.alignment = Alignment(horizontal='left', vertical='center', wrap_text=True)
        cell.border = Border(bottom=Side('thin', color=GOLD))
    ws.row_dimensions[start_row - 1].height = 42
    ws.row_dimensions[start_row].height = 30


def dropdown(ws, column_letter, values, first, last, title, message):
    dv = DataValidation(type='list', formula1='"' + ','.join(values) + '"',
                        allow_blank=True, showDropDown=False)
    dv.error = message
    dv.errorTitle = title
    dv.prompt = message
    dv.promptTitle = title
    ws.add_data_validation(dv)
    dv.add(f'{column_letter}{first}:{column_letter}{last}')


def text_column(ws, column_letter, first, last):
    """Format as text so a typed date stays the words that were typed."""
    for r in range(first, last + 1):
        ws[f'{column_letter}{r}'].number_format = '@'


wb = Workbook()
ROWS = 400

# ----------------------------------------------------------- read me first
info = wb.active
info.title = 'Read me first'
info.sheet_view.showGridLines = False
info.column_dimensions['A'].width = 3
info.column_dimensions['B'].width = 104

lines = [
    ('title', 'Marbella Group — master intake sheet'),
    ('sub',   'Fill this in, then upload it on the HR desk under Bulk intake. Nothing else needs doing to it.'),
    ('gap',   ''),
    ('h',     'Which tab to use'),
    ('p',     '"New people" — for anybody who is NOT on the roster yet. The system issues each of them an employee ID.'),
    ('p',     '"Fill in blanks" — for people who ARE already on the roster and whose details you have gone and collected.'),
    ('p',     'Do not use "New people" for somebody already on the roster. They will be held back as a duplicate, which is the right answer but a wasted afternoon.'),
    ('gap',   ''),
    ('h',     'The four rules'),
    ('p',     '1.  A BLANK CELL MEANS "I do not know yet". On the "Fill in blanks" tab it leaves what is on file alone — it never clears it. So a sheet of nothing but email addresses cannot wipe the phone numbers somebody else collected.'),
    ('p',     '2.  DATES ARE TYPED AS WORDS: 12 Aug 2026. Those columns are set to text so Excel leaves them alone. If a date turns into 45891 or 08/12/26, clear the cell and type it again.'),
    ('p',     '3.  DO NOT ADD, RENAME, REORDER OR DELETE COLUMNS. The names are what the system matches on. Add your own notes on a new tab if you need to.'),
    ('p',     '4.  ONE PERSON PER ROW, no blank rows in the middle, no headings like "SALES DEPARTMENT" across the sheet.'),
    ('gap',   ''),
    ('h',     'What happens when you upload it'),
    ('p',     'Every row is checked one at a time. Rows that are fine are listed; rows that are not are held back WITH A REASON against the person\'s name — a mobile number that cannot be dialled, a joining date nobody can read, an employee ID already in use. Nothing is written until you press the button on the last step, and the check you see is the same code that does the writing, so the preview cannot be wrong.'),
    ('p',     'Twenty good rows are never lost because row eleven has a typo.'),
    ('gap',   ''),
    ('h',     'What a filled row looks like'),
    ('ex',    'Employee Name        Bhola Prasad'),
    ('ex',    'Designation          Mason'),
    ('ex',    'Department           Maintenance'),
    ('ex',    'Site                 Marbella Grand'),
    ('ex',    'Date of Joining      12 Aug 2026'),
    ('ex',    'Date of Birth        04 Mar 1991'),
    ('ex',    'Gender               Male'),
    ('ex',    'Personal Mobile      98765 43210'),
    ('ex',    'Personal Email       bhola.prasad@gmail.com'),
    ('p',     'The example is here and not on the data tabs on purpose: a sample row of invented people is exactly the thing that gets uploaded by accident.'),
    ('gap',   ''),
    ('h',     'Pay'),
    ('p',     'Leave Basic, HRA and Other Allowances blank unless you have been told the exact split. It is better to set the salary on the person afterwards, where you type ONE figure — the monthly gross — and the company\'s own policy splits it for you.'),
    ('p',     'The "Fill in blanks" tab has no pay columns at all, on purpose. Changing a hundred people\'s pay by pasting three columns is how a wrong figure reaches a hundred payslips at once. Pay is changed one person at a time, where somebody looks at it.'),
    ('gap',   ''),
    ('h',     'Anything you are unsure about'),
    ('p',     'Leave it blank and say so. A blank cell is a question somebody can answer. A guess is a wrong record that nobody knows is wrong.'),
    ('p',     'If something on this sheet does not fit how the company actually works, approach the management — the sheet should follow the company, not the other way round.'),
]
r = 2
for kind, text in lines:
    c = info.cell(row=r, column=2, value=text)
    if kind == 'title':
        c.font = Font(name='Calibri', size=20, bold=True, color=INK)
        info.row_dimensions[r].height = 30
    elif kind == 'sub':
        c.font = Font(name='Calibri', size=11, color='5A504A')
        c.alignment = Alignment(wrap_text=True)
    elif kind == 'h':
        c.font = Font(name='Calibri', size=12, bold=True, color=GOLD)
        info.row_dimensions[r].height = 24
    elif kind == 'ex':
        c.font = Font(name='Consolas', size=10, color='3A3A3A')
    elif kind == 'gap':
        info.row_dimensions[r].height = 8
    else:
        c.font = Font(name='Calibri', size=10.5, color='3A3A3A')
        c.alignment = Alignment(wrap_text=True, vertical='top')
        info.row_dimensions[r].height = max(16, 14 * (len(text) // 100 + 1))
    r += 1

# --------------------------------------------------------------- new people
new = wb.create_sheet('New people')
new.sheet_view.showGridLines = False
head(new, NEW_COLUMNS, 2)
new.freeze_panes = 'A3'
for letter in ('F', 'G'):
    text_column(new, letter, 3, ROWS)
text_column(new, 'I', 3, ROWS)
text_column(new, 'N', 3, ROWS)
text_column(new, 'O', 3, ROWS)
dropdown(new, 'D', DEPARTMENTS, 3, ROWS, 'Department', 'Pick one of the twelve departments.')
dropdown(new, 'E', SITES, 3, ROWS, 'Site', 'Where they work. Blank means Marbella Grand.')
dropdown(new, 'H', GENDERS, 3, ROWS, 'Gender', 'Leave blank if nobody has asked them.')

# ------------------------------------------------------------ fill in blanks
fill = wb.create_sheet('Fill in blanks')
fill.sheet_view.showGridLines = False
head(fill, FILL_COLUMNS, 2)
fill.freeze_panes = 'A3'
for letter in ('C', 'E', 'H', 'I'):
    text_column(fill, letter, 3, ROWS)
dropdown(fill, 'D', GENDERS, 3, ROWS, 'Gender', 'Leave blank if nobody has asked them.')

# ------------------------------------------------------------------- lists
lists = wb.create_sheet('Lists')
lists.sheet_view.showGridLines = False
lists['A1'] = 'What the words on the other tabs have to be'
lists['A1'].font = Font(name='Calibri', size=12, bold=True, color=INK)
cols = [('Departments', DEPARTMENTS), ('Sites', SITES), ('Employment type', TYPES),
        ('Gender', GENDERS), ('Companies (who pays them)', COMPANIES)]
for i, (title, values) in enumerate(cols, start=1):
    letter = get_column_letter(i)
    lists.column_dimensions[letter].width = max(20, len(title) + 4, max(len(v) for v in values) + 3)
    c = lists.cell(row=3, column=i, value=title)
    c.font = Font(name='Calibri', size=10, bold=True, color='FFFFFF')
    c.fill = PatternFill('solid', fgColor=INK)
    for j, v in enumerate(values, start=4):
        lists.cell(row=j, column=i, value=v).font = Font(name='Calibri', size=10)
note = lists.cell(row=4 + max(len(v) for _, v in cols) + 2, column=1,
                  value='Who pays somebody is NOT asked on the intake sheet. It is set on the person afterwards, '
                        'because it decides the letterhead their papers go out on and which salary policy their '
                        'payslip follows — and getting it wrong in bulk is worse than asking twice.')
note.font = Font(name='Calibri', size=10, italic=True, color='7A6E5A')
note.alignment = Alignment(wrap_text=True)
lists.merge_cells(start_row=note.row, start_column=1, end_row=note.row + 2, end_column=5)

wb.save(OUT)
print(f'{OUT}  —  {len(NEW_COLUMNS)} columns to add people, {len(FILL_COLUMNS)} to fill blanks')
