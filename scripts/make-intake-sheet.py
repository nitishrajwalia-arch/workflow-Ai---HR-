#
# © 2026 Marbella Group. All rights reserved.
#
# Proprietary and confidential. Not to be used, copied, modified or
# distributed without the written permission of the management. See LICENSE.
#
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
import os
import subprocess
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

# The lists come OUT OF THE DATABASE, not out of this file. A project added on
# the Companies screen brings a site office with it, and a sheet that still
# offers last quarter's four sites is a sheet that sends HR to a dropdown which
# does not contain the answer. The literals below are only what to fall back to
# when there is no database to ask — building the sheet should not need one.
FALLBACK_DEPARTMENTS = ['Accounts', 'Admin', 'CRM', 'HR', 'Horticulture', 'IT', 'Maintenance',
                        'Marketing', 'Pantry', 'Project', 'Purchase', 'Sales']
YES_NO = ['Yes', 'No']
FALLBACK_SITES = ['Grand', 'Twin Towers', 'Royce', 'Curo One', 'Manifest']
FALLBACK_COMPANIES = ['SRG Developers & Promoters', 'SRG Marbella Developers And Promoters LLP',
                      'Garg Builders And Promoters LLP', 'New Marbella Developers And Promoters LLP']


def ask(sql, fallback):
    """One column out of the database, or the fallback if it cannot be reached."""
    url = os.environ.get('DATABASE_URL') or ''
    if not url:
        try:
            for line in open('apps/api/.env'):
                if line.startswith('DATABASE_URL'):
                    url = line.split('=', 1)[1].strip().strip('"')
        except OSError:
            return fallback
    if not url:
        return fallback
    # Prisma writes ?schema=public on the end; psql refuses a parameter it does
    # not know and the refusal reads like a connection failure.
    try:
        out = subprocess.run(['psql', url.split('?')[0], '-At', '-c', sql],
                             capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return fallback
    rows = [r.strip() for r in out.splitlines() if r.strip()]
    return rows or fallback


DEPARTMENTS = ask('select distinct dept from person order by dept', FALLBACK_DEPARTMENTS)
# The SHORT name, because that is what somebody writes in a Site column, and the
# importer matches a site on its short name as well as its id.
SITES = ask('select short from office order by short', FALLBACK_SITES)
COMPANIES = ask('select name from company order by name', FALLBACK_COMPANIES)
TYPES = ['Staff', 'Site']
GENDERS = ['Male', 'Female', 'Other', 'Prefers not to say']

# Exactly the columns the importer matches, in the order it lists them.
# (header, width, required, note)
NEW_COLUMNS = [
    # ---- who they are
    ('Employee Name',    26, True,  'As it should appear on the ID card.'),
    ('Employee ID',      14, False, 'Leave blank and the system issues the next one for that department.'),
    ('Designation',      24, True,  'Their role — Mason, Site Engineer, Accountant.'),
    ('Department',       16, True,  'Pick from the list. A department not on it is rejected, not invented.'),
    ('Site',             18, False, 'Where they work. Pick from the list. Blank means Marbella Grand.'),
    ('Date of Joining',  16, True,  'Type it as 12 Aug 2026. Do not let Excel turn it into a date.'),
    ('Date of Birth',    16, False, 'Same format. Blank is fine — it can be filled in later.'),
    ('Gender',           14, False, 'Pick from the list, or leave blank if nobody has asked.'),
    # ---- their own
    ('Personal Mobile',  18, True,  'THEIR OWN number, 10 digits. Not the company one.'),
    ('Personal Email',   26, False, 'THEIR OWN email. A @marbellagroup.in address is refused — it dies with the account.'),
    # ---- what the company issued them
    ('Work Phone',       18, False, 'The company SIM, if one has been issued. This is what gets cancelled when they leave.'),
    ('Work Email',       26, False, 'Their @marbellagroup.in address, if they have one. Revoked when they leave.'),
    ('Device IMEI',      20, False, 'Only if the company has issued them a handset.'),
    # ---- what they are paid
    ('Monthly Gross',    14, False, 'ONE figure, rupees a month. If you fill this in you can leave the five below blank.'),
    ('Basic',            12, False, 'Only if you have been told the exact split. Otherwise leave the five blank and give the gross.'),
    ('HRA',              12, False, 'Rupees a month.'),
    ('Travelling',       12, False, 'Rupees a month.'),
    ('Medical',          12, False, 'Rupees a month.'),
    ('Other Allowances', 16, False, 'Rupees a month. The sheet calls this Special on some books.'),
    ('PF Applies',       12, False, 'Yes or No. Anything else is read as No.'),
    ('PF Wage',          12, False, 'ONLY if this person\'s PF wage is not the company\'s standard. Almost always blank.'),
    ('ESI Applies',      12, False, 'Yes or No. Anything else is read as No.'),
    # ---- papers
    ('PAN',              14, False, 'Ten characters, e.g. ABCDE1234F. Checked on the way in.'),
    ('Aadhaar',          18, False, 'Twelve digits. Its own check digit is verified, not just the length.'),
]


FILL_COLUMNS = [
    ('Employee ID',      14, True,  'The only column that must be filled. Every row is matched on it.'),
    ('Employee Name',    26, False, 'Not read — it is here so you can see whose row you are on.'),
    ('Date of Birth',    16, False, 'Type it as 12 Aug 2026.'),
    ('Gender',           14, False, 'Pick from the list.'),
    ('Personal Mobile',  18, False, 'THEIR OWN number, 10 digits.'),
    ('Personal Email',   26, False, 'THEIR OWN email, not the company one.'),
    ('Work Phone',       18, False, 'The company SIM, if one has been issued.'),
    ('Work Email',       26, False, 'Their @marbellagroup.in address, if they have one.'),
    ('Reports To',       16, False, 'The employee ID of their manager, e.g. MB-PRJ-0014.'),
    ('Device IMEI',      20, False, 'Only if a handset has been issued.'),
    ('PAN',              14, False, 'Ten characters, e.g. ABCDE1234F.'),
    ('Aadhaar',          18, False, 'Twelve digits.'),
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
    ('ex',    'Work Phone           98111 22233'),
    ('ex',    'Work Email           bhola.prasad@marbellagroup.in'),
    ('ex',    'Monthly Gross        32000'),
    ('ex',    'PF Applies           Yes'),
    ('ex',    'ESI Applies          No'),
    ('p',     'The example is here and not on the data tabs on purpose: a sample row of invented people is exactly the thing that gets uploaded by accident.'),
    ('gap',   ''),
    ('h',     'Their own, and the company\'s'),
    ('p',     'PERSONAL MOBILE and PERSONAL EMAIL are theirs. A @marbellagroup.in address is refused in the personal column on purpose: that account closes the day they leave, which is exactly when you need to reach them.'),
    ('p',     'WORK PHONE and WORK EMAIL are the opposite — things the company issued and must take back. They appear on the deboarding checklist when somebody leaves, next to the laptop and the ID card. Fill them in and nobody has to remember to cancel a SIM that is still billing.'),
    ('gap',   ''),
    ('h',     'Pay'),
    ('p',     'The simplest thing is to fill in MONTHLY GROSS and leave the five columns after it blank. The company\'s own policy splits one figure into Basic, HRA, Travelling, Medical and Other for you, and it splits it the way that company\'s book already does.'),
    ('p',     'Fill the five in only when you have been told the exact split and it is NOT what the policy would produce. If you fill in both, the gross you typed wins and the difference is worth a second look.'),
    ('p',     'PF APPLIES and ESI APPLIES are Yes or No for that person. Leave PF WAGE blank unless this one person\'s PF wage is not the company\'s standard — almost nobody\'s is. The RATES are not on this sheet at all: they are company policy, set once under Payroll with the rule they come from written beside them, and a rate typed on 126 rows is 126 chances to create a second policy by accident.'),
    ('p',     'The "Fill in blanks" tab has no pay columns at all, on purpose. Changing a hundred people\'s pay by pasting three columns is how a wrong figure reaches a hundred payslips at once. Pay is changed one person at a time, where somebody looks at it.'),
    ('gap',   ''),
    ('h',     'PAN and Aadhaar'),
    ('p',     'Both are checked properly on the way in — the Aadhaar by its own check digit, not just its length — so a mistyped one is held back rather than filed.'),
    ('p',     'They are also the most sensitive thing on this sheet. Once it is filled in, this file carries identity documents for everybody on it: keep it off email and shared drives, upload it, and delete your copy. If you would rather not put them here at all, leave both columns blank and collect them on the person\'s own record afterwards — the system is happy either way.'),
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
# Anything Excel would "helpfully" turn into a date, a number or scientific
# notation. A twelve-digit Aadhaar becomes 2.34568E+11 the moment it is a
# number, and a leading zero on a mobile is gone for good.
for letter in ('F', 'G', 'I', 'K', 'M', 'W', 'X'):
    text_column(new, letter, 3, ROWS)
dropdown(new, 'D', DEPARTMENTS, 3, ROWS, 'Department',
         'Pick one of the %d departments. Anything else is rejected.' % len(DEPARTMENTS))
dropdown(new, 'E', SITES, 3, ROWS, 'Site', 'Where they work. Blank means Marbella Grand.')
dropdown(new, 'H', GENDERS, 3, ROWS, 'Gender', 'Leave blank if nobody has asked them.')
for letter in ('T', 'V'):
    dropdown(new, letter, YES_NO, 3, ROWS, 'Yes or No',
             'Anything that is not Yes is read as No.')

# ------------------------------------------------------------ fill in blanks
fill = wb.create_sheet('Fill in blanks')
fill.sheet_view.showGridLines = False
head(fill, FILL_COLUMNS, 2)
fill.freeze_panes = 'A3'
for letter in ('C', 'E', 'G', 'I', 'J', 'K', 'L'):
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
