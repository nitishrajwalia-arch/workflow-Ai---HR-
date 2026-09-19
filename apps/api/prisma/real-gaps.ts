/**
 * What HR confirmed on the data-gap workbook, 18 Sep 2026.
 *
 * `real-data.ts` is what the company's own registers say. This file is what HR
 * went and asked, and the seed applies it on top. They are kept apart so that
 * every field in the database can still be traced to the sheet it came from.
 *
 * Nothing here is guessed. A cell that was blank, or read "Not Given", leaves
 * the field alone rather than overwriting it with an empty string. Anything the
 * sheet says that contradicts what is on file is in GAP_CONFLICTS below, for
 * somebody to answer, rather than resolved quietly here.
 *
 * Regenerate with scripts/import/05-gaps.py — do not hand-edit.
 */

/** Per person. Only the keys present were answered; the rest are untouched. */
export const GAP_PEOPLE = [
  {
    "id": "MB-ACC-0001",
    "gender": "male",
    "email": "sonujangra2110@gmail.com",
    "reportsToNote": "Managing Director (Deepak Garg)"
  },
  {
    "id": "MB-ACC-0002",
    "gender": "male",
    "email": "parveen.dahiya0257@gmail.com",
    "reportsTo": "MB-ACC-0001"
  },
  {
    "id": "MB-ACC-0003",
    "gender": "male",
    "email": "rkraj87kumar@gmail.com",
    "reportsTo": "MB-ACC-0001"
  },
  {
    "id": "MB-ACC-0004",
    "gender": "male",
    "email": "rahulmehta48745@gmail.com",
    "phone": "7347503785",
    "reportsTo": "MB-ACC-0001"
  },
  {
    "id": "MB-ACC-0005",
    "gender": "male",
    "email": "asureshakash035@gmail.com",
    "reportsTo": "MB-ACC-0001"
  },
  {
    "id": "MB-ACC-0006",
    "gender": "male",
    "email": "pawansharma315@gmail.com",
    "reportsTo": "MB-ACC-0001"
  },
  {
    "id": "MB-ADM-0001",
    "gender": "female",
    "email": "8825baljinderkaur@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-ADM-0002",
    "gender": "female",
    "email": "varinderbenipal1998@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-ADM-0003",
    "gender": "female",
    "email": "chinushrma901@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-ADM-0004",
    "gender": "male",
    "email": "9amit1973@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-ADM-0005",
    "gender": "male",
    "email": "ak272181@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-CRM-0001",
    "gender": "female",
    "email": "kiransharma764@gmail.com",
    "reportsToNote": "Managing Director (Deepak Garg)"
  },
  {
    "id": "MB-CRM-0002",
    "gender": "male",
    "email": "dpandey2006@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0003",
    "gender": "male",
    "email": "kashyapkushal777@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0004",
    "gender": "female",
    "email": "k999hushiarora@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0005",
    "gender": "male",
    "email": "papukumar79000@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0006",
    "gender": "male",
    "email": "jatingandhi2006@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0007",
    "gender": "male",
    "email": "krishansingh13667@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-CRM-0008",
    "gender": "male",
    "email": "dineshbhardwaj907@gmail.com",
    "reportsTo": "MB-CRM-0001"
  },
  {
    "id": "MB-HR-0001",
    "gender": "female",
    "email": "poojadahiya.info@gmail.com",
    "reportsToNote": "Managing Director (Rajesh Walia)"
  },
  {
    "id": "MB-HRT-0001",
    "gender": "male",
    "phone": "7708763200",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-HRT-0002",
    "gender": "male",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-IT-0001",
    "gender": "male",
    "email": "ompraksh.uid@gmail.com",
    "reportsToNote": "Managing Director (Rajesh Walia)"
  },
  {
    "id": "MB-MNT-0001",
    "gender": "male",
    "email": "vishan1994dass@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0002",
    "gender": "male",
    "email": "ravindrakumarbhami99@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0003",
    "gender": "male",
    "email": "manojver13@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0004",
    "gender": "male",
    "email": "pallugujjar3@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0005",
    "gender": "male",
    "email": "bhupindersinghdhanoa0082@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0006",
    "gender": "male",
    "email": "rky866123@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0007",
    "gender": "male",
    "email": "sk2200969@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0008",
    "gender": "male",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0009",
    "designation": "Plumber",
    "gender": "male",
    "email": "sultanaliflp@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0010",
    "gender": "male",
    "email": "paramjitsingh3180@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0011",
    "gender": "male",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0012",
    "gender": "male",
    "email": "vickys99041@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0013",
    "gender": "male",
    "email": "irfankhanmanauli@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0014",
    "gender": "male",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0015",
    "gender": "male",
    "email": "kumarrahulsangral5244@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0016",
    "gender": "male",
    "email": "ballimohali428@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0017",
    "gender": "male",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0018",
    "gender": "male",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MNT-0019",
    "gender": "male",
    "email": "amanmehra97@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-MNT-0020",
    "gender": "male",
    "email": "arjunpanchkula@gmail.com",
    "reportsTo": "MB-MNT-0019"
  },
  {
    "id": "MB-MKT-0001",
    "gender": "male",
    "email": "virsingh343@gmail.com",
    "reportsToNote": "Managing Director (Rajesh Walia)"
  },
  {
    "id": "MB-MKT-0002",
    "gender": "male",
    "email": "ashingari.graphics@gmail.com",
    "reportsTo": "MB-MKT-0001"
  },
  {
    "id": "MB-PAN-0001",
    "gender": "male",
    "email": "beerukc95@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-PAN-0002",
    "gender": "male",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-PAN-0003",
    "gender": "male",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-PAN-0004",
    "gender": "male",
    "email": "sumitsaxena363@gmail.com",
    "reportsTo": "MB-HR-0001"
  },
  {
    "id": "MB-PRJ-0001",
    "gender": "male",
    "email": "gopal.sng@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0002",
    "gender": "male",
    "email": "swaranjit2494@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0003",
    "gender": "male",
    "email": "vikaslakhanpal@ymail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0004",
    "gender": "male",
    "email": "Jagmohansingh8118@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0005",
    "gender": "male",
    "email": "malhi.gne06@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0006",
    "gender": "male",
    "email": "yuvimall97@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0007",
    "gender": "male",
    "email": "parveenkumar55555@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0008",
    "gender": "male",
    "email": "manpreetsingh74259@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0009",
    "gender": "male",
    "email": "rkumar4391@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0010",
    "gender": "male",
    "email": "anilsaklani42042015@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0011",
    "gender": "male",
    "email": "er.daljitkalsi@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0012",
    "gender": "male",
    "email": "mohansinghkharola2810@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0013",
    "gender": "male",
    "email": "dhiman.anil008@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0014",
    "name": "Ajay Goel",
    "gender": "male",
    "email": "ajaygoel1965@gmail.com",
    "reportsToNote": "Managing Directors (Rajesh Walia, Deepak Garg, Girish Goel, Parveen Garg)"
  },
  {
    "id": "MB-PRJ-0015",
    "gender": "male",
    "email": "himahahvir@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0016",
    "gender": "male",
    "email": "brthakur5423@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0017",
    "gender": "male",
    "email": "gurudutt1990@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0018",
    "gender": "male",
    "email": "dhimannkush495@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0019",
    "gender": "male",
    "email": "souravrana176023@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0020",
    "gender": "male",
    "email": "vikramhira3041@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0021",
    "gender": "male",
    "email": "deepakhappy90@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0022",
    "gender": "male",
    "email": "jaswindersandhu441@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0023",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0024",
    "gender": "male",
    "email": "amnbhogal23@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0025",
    "gender": "male",
    "email": "snlthakur07@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0026",
    "gender": "male",
    "email": "shivnandanram324@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0027",
    "gender": "male",
    "email": "amarjitsaini73@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0028",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0029",
    "gender": "male",
    "email": "rohitbirdi59@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0030",
    "gender": "male",
    "email": "thakurabhishek73@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0031",
    "gender": "male",
    "email": "sk.sainirmc@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0032",
    "gender": "male",
    "email": "mukesh.negi8382@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0033",
    "gender": "male",
    "email": "pkstalwarr@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0034",
    "gender": "male",
    "email": "tilaksaini18@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0035",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0036",
    "name": "Ravinder Bawa",
    "gender": "male",
    "email": "ravinderbawa085@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0037",
    "gender": "male",
    "email": "rahulattri000001@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0038",
    "gender": "male",
    "email": "gill064@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0039",
    "gender": "male",
    "email": "fyadav1966@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0040",
    "gender": "male",
    "email": "gillsandhrash@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0041",
    "gender": "male",
    "email": "mandeepdhiman104@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0042",
    "gender": "male",
    "email": "s63896616@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0043",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0044",
    "gender": "male",
    "email": "rajputrahulthakur169@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0045",
    "gender": "male",
    "email": "gurpreetsinghvirdi94@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0046",
    "gender": "male",
    "email": "shivamkumarsitm@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0047",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0048",
    "gender": "male",
    "email": "rajputana717@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0049",
    "gender": "male",
    "email": "chauhanpradeeppk1994@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0050",
    "gender": "male",
    "email": "pk8937793@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0051",
    "gender": "male",
    "email": "pankaj15august1998@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0052",
    "gender": "male",
    "email": "neerajverma132213@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0053",
    "gender": "male",
    "email": "sgaganjot283@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0054",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0055",
    "gender": "male",
    "email": "nareshnaresh61700@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0056",
    "gender": "male",
    "email": "ramroopyadav8957@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0057",
    "name": "Sourav Alwa",
    "gender": "male",
    "email": "alwasourav185@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0058",
    "gender": "male",
    "email": "patelakhil839@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0059",
    "name": "Pardeep Kumar",
    "gender": "male",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0060",
    "name": "Prem Ranjan",
    "gender": "male",
    "phone": "8283853528",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PRJ-0061",
    "gender": "male",
    "email": "sonianurag103@gmail.com",
    "reportsTo": "MB-PRJ-0014"
  },
  {
    "id": "MB-PUR-0001",
    "gender": "male",
    "email": "dchetanmalik@gmail.com",
    "reportsToNote": "Managing Directors (Rajesh Walia, Deepak Garg, Girish Goel, Parveen Garg)"
  },
  {
    "id": "MB-PUR-0002",
    "gender": "male",
    "email": "sandeeppathania85@gmail.com",
    "reportsTo": "MB-PUR-0001"
  },
  {
    "id": "MB-PUR-0003",
    "gender": "male",
    "email": "manojver13@gmail.com",
    "reportsTo": "MB-PUR-0001"
  },
  {
    "id": "MB-PUR-0004",
    "gender": "male",
    "email": "gurnoor09501@gmail.com",
    "reportsTo": "MB-PUR-0001"
  },
  {
    "id": "MB-SAL-0001",
    "gender": "male",
    "email": "gurbindersingh599@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0002",
    "gender": "female",
    "email": "inderjiit.kaurr@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0003",
    "gender": "male",
    "email": "mohitkakkar3130@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0004",
    "gender": "female",
    "email": "manvimahajan0786@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0005",
    "gender": "female",
    "email": "vpriyankaa30@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0006",
    "gender": "male",
    "email": "ravidsharma230@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0007",
    "gender": "male",
    "email": "saransh.sr@hotmail.com",
    "reportsToNote": "Managing Directors (Rajesh Walia, Deepak Garg, Girish Goel, Parveen Garg)"
  },
  {
    "id": "MB-SAL-0008",
    "gender": "male",
    "email": "siorabhdua.bs33@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0009",
    "gender": "female",
    "email": "sharmatwinkle1312@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0010",
    "gender": "male",
    "email": "harjotwazir@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0011",
    "gender": "female",
    "email": "rishika22797@gmail.com",
    "reportsTo": "MB-SAL-0007"
  },
  {
    "id": "MB-SAL-0012",
    "gender": "female",
    "email": "priyankajalpaik1997@gmail.com",
    "reportsTo": "MB-SAL-0007"
  }
] as const;

/** The leave rules, one set for every department — sheet 3 says they do not differ. */
export const GAP_LEAVE = {
  "casual": 12,
  "sick": 6,
  "earned": 12,
  "lateAfter": 10,
  "lateStrikes": 3,
  "carryForward": false,
  "encashable": true,
  "probation": "1 Day per Month",
  "maternityWeeks": 26,
  "paternityDays": 7,
  "notice": "1 Month",
  "sameEverywhere": true,
  "setBy": "HR Department",
  "setOn": "18 Sep 2026"
} as const;

/** The holiday calendar, as supplied. Blank before this; the attendance rules were meaningless without it. */
export const GAP_HOLIDAYS = [
  {
    "name": "Republic Day",
    "on": "26 Jan 2027",
    "onDate": "2027-01-26",
    "allSites": false,
    "note": "National holiday"
  },
  {
    "name": "Independence Day",
    "on": "15 Aug 2027",
    "onDate": "2027-08-15",
    "allSites": false,
    "note": "National holiday"
  },
  {
    "name": "Gandhi Jayanti",
    "on": "02 Oct 2027",
    "onDate": "2027-10-02",
    "allSites": false,
    "note": "National holiday"
  },
  {
    "name": "Holi",
    "on": "22 Mar 2027",
    "onDate": "2027-03-22",
    "allSites": false,
    "note": "Punjab holiday"
  },
  {
    "name": "Baisakhi",
    "on": "14 Apr 2027",
    "onDate": "2027-04-14",
    "allSites": false,
    "note": "Punjab holiday"
  },
  {
    "name": "Guru Nanak Jayanti",
    "on": "14 Nov 2027",
    "onDate": "2027-11-14",
    "allSites": false,
    "note": "Punjab holiday"
  },
  {
    "name": "Dussehra",
    "on": "10 Oct 2027",
    "onDate": "2027-10-10",
    "allSites": false,
    "note": "Vijaya Dashami"
  },
  {
    "name": "Diwali",
    "on": "29 Oct 2027",
    "onDate": "2027-10-29",
    "allSites": false,
    "note": "Diwali"
  },
  {
    "name": "Eid-ul-Fitr",
    "on": "10 Mar 2027",
    "onDate": "2027-03-10",
    "allSites": false,
    "note": "Date may be subject to official confirmation"
  },
  {
    "name": "Christmas Day",
    "on": "25 Dec 2027",
    "onDate": "2027-12-25",
    "allSites": false,
    "note": "Christmas holiday"
  }
] as const;

/** Working days and the grace period, per department. Hours themselves were already on file. */
export const GAP_HOURS = {
  "Accounts": {
    "days": "Mon–Sat",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": ""
  },
  "Admin": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "CRM": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "HR": {
    "days": "Mon–Sat",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": ""
  },
  "Horticulture": {
    "days": "Mon–Sat",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": ""
  },
  "IT": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "Maintenance": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "Marketing": {
    "days": "Mon–Sat",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": ""
  },
  "Pantry": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "Project": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "Purchase": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  },
  "Sales": {
    "days": "As per fixed weekly off",
    "grace": 10,
    "setBy": "Management",
    "setOn": "18 Sep 2026",
    "note": "HR confirmed a fixed weekly off. The sheet does not say which day it falls on."
  }
} as const;

/** Keyed by department and title, because one title means different jobs in different departments. */
export const GAP_JDS = [
  {
    "dept": "Accounts",
    "role": "ACCOUNT HEAD",
    "jd": "Heads the entire Account/Finance Function.Oversees accounting,financial reporting,taxes,audits, budgets, cash flow and accounts team"
  },
  {
    "dept": "Accounts",
    "role": "AGM",
    "jd": "Helps Manage a department/business function, sets targets,monitors performance,coordinates teams and reports to senior management."
  },
  {
    "dept": "Accounts",
    "role": "Account Manager",
    "jd": "Manage a portfolio of customers /accounts.It includes customer payments, account statements, booking /collection issues,documentation and coordination with sales/Customer services."
  },
  {
    "dept": "Accounts",
    "role": "Assistant Manager",
    "jd": "Supports the manager in day to day operations,supervises staff,follows up the tasks,prepares reports and handles excalated issues."
  },
  {
    "dept": "Admin",
    "role": "Front Desk Executive",
    "jd": "Handles Visitors and calls, welcomes clients, manages reception, schedules appointments,maintains visitor records,coordinates with all departments teams."
  },
  {
    "dept": "Admin",
    "role": "Rider",
    "jd": "Handles field based errands and deliveries- Documents,Cheques,files, letters,or other materialsbetween the office,customers,banks,government Offices and project sites."
  },
  {
    "dept": "CRM",
    "role": "CRM Manager",
    "jd": "Manages customer relationships after booking/sales- customer queries, payment follow ups, payment follow ups, possession ,documentation,complaints and CRM team performance."
  },
  {
    "dept": "CRM",
    "role": "DGM",
    "jd": "responsible for leading and managing the entire Customer Relationship Management function.the role focuses on customer satisfaction,post sales services,collection coordination,documentation,possession ,complaint resolution and ensure smooth customer journey from booking to handover"
  },
  {
    "dept": "CRM",
    "role": "Filing Executive",
    "jd": "Maintain and organizes cutomer/projects documents,files,records,data entry,scanning and retrieval of documents"
  },
  {
    "dept": "CRM",
    "role": "GRE",
    "jd": "Timely acknowledgement and response to customer queries,Timely coordination and closure of customer complaints,Completion of scheduled follow-ups,Accuracy and completeness of customer records,Timely collection and processing of pending documents,Timely follow-up of assigned customer dues,Customer feedback and service quality"
  },
  {
    "dept": "CRM",
    "role": "Junior Executive",
    "jd": "Accuracy and completeness of assigned customer records,Timely completion of assigned follow-ups,Timely follow-up and updating of pending documents,Timely acknowledgement and routing of queries,Accurate recording and follow-up of assigned complaints,Timely completion of assigned payment follow-ups,Assigned activities completed within timelines,Effective coordination with internal departments"
  },
  {
    "dept": "HR",
    "role": "HR Manager",
    "jd": "manpower planning, recruitment, onboarding, employee relations, performance management, payroll coordination, attendance and leave administration, HR compliance, employee engagement, training and development, HR documentation and HR MIS."
  },
  {
    "dept": "Horticulture",
    "role": "Mali",
    "jd": "responsible for ensuring that all assigned landscape areas remain clean, healthy, attractive and properly maintained through watering, pruning, weeding, planting, mowing, fertilising and other horticultural activities as directed by the Horticulture Supervisor."
  },
  {
    "dept": "IT",
    "role": "IT Manager",
    "jd": "Manage day-to-day IT infrastructure and operations,Manage LAN, WAN, Wi-Fi, VPN and internet connectivity,Manage computers, laptops, printers, scanners, servers, networking equipment and other IT assets,Manage and support business applications used by Marbella Group,Coordinate administration and technical support for ERP, CRM, HRMS and other business systems,Implement and maintain appropriate IT security controls,Establish and maintain appropriate backup procedures,Ensure timely resolution of employee IT issues,Identify IT hardware, software and service requirements."
  },
  {
    "dept": "Maintenance",
    "role": "Carpainter",
    "jd": "Carpentry & Woodwork,Installation & Fit-Out Work,Repair & Maintenance,Measurement & Material Handling,Tools & Equipment,QualityControl,Safety & Housekeeping,Team Coordination,Follow all site safety rules and instructions."
  },
  {
    "dept": "Maintenance",
    "role": "Civil Supervisor",
    "jd": "Civil Supervisor responsible for supervising and coordinating day-to-day civil construction, repair, maintenance, renovation, finishing and related site activities across Marbella Group properties and project sites.Allocate routine civil work to assigned workers. Supervise approved contractors and civil activities."
  },
  {
    "dept": "Maintenance",
    "role": "Club Manager",
    "jd": "Manage overall club operations, facilities, staff, member services, events, housekeeping and maintenance while ensuring quality service and safety."
  },
  {
    "dept": "Maintenance",
    "role": "Electrician",
    "jd": "Install, maintain and repair electrical systems, lighting, wiring, panels and electrical equipment while following safety standards."
  },
  {
    "dept": "Maintenance",
    "role": "Fire Man",
    "jd": "Monitor fire-safety systems, conduct routine inspections, respond to fire emergencies and support fire-safety drills and evacuation procedures."
  },
  {
    "dept": "Maintenance",
    "role": "Gym Trainer",
    "jd": "Guide members in exercise and fitness activities, prepare basic workout plans, ensure safe equipment use and maintain gym discipline."
  },
  {
    "dept": "Maintenance",
    "role": "Help Desk",
    "jd": "Receive and record resident/member complaints and service requests, coordinate with concerned departments and follow up until resolution."
  },
  {
    "dept": "Maintenance",
    "role": "Maintainance Manager",
    "jd": "Manage building maintenance, electrical, plumbing, civil and other technical services; supervise staff and ensure timely resolution of maintenance issues."
  },
  {
    "dept": "Maintenance",
    "role": "Painter",
    "jd": "Carry out painting, polishing, surface preparation and touch-up work for buildings, offices, common areas and other property facilities."
  },
  {
    "dept": "Maintenance",
    "role": "Plumber",
    "jd": "Install, repair and maintain water-supply, drainage, sanitary and plumbing systems and attend plumbing-related complaints."
  },
  {
    "dept": "Maintenance",
    "role": "Plunber",
    "jd": "Install, repair and maintain water-supply, drainage, sanitary and plumbing systems and attend plumbing-related complaints."
  },
  {
    "dept": "Maintenance",
    "role": "SUPERVISOR Civil",
    "jd": "Supervise civil construction, repair and maintenance works, coordinate workers/contractors, monitor quality and ensure timely completion of assigned work."
  },
  {
    "dept": "Maintenance",
    "role": "Technical",
    "jd": "Manage overall technical and engineering operations, including civil, electrical, plumbing, MEP and maintenance activities, ensuring safety, quality, timely completion and proper coordination."
  },
  {
    "dept": "Marketing",
    "role": "Graphic Manager",
    "jd": "Manage the company’s graphic design and visual communication requirements, including project creatives, brochures, digital content, advertisements and branding materials, ensuring consistent brand identity and timely delivery."
  },
  {
    "dept": "Marketing",
    "role": "Marketing Manager",
    "jd": "Plan and manage marketing activities for Marbella Group projects, including digital marketing, campaigns, branding, promotions and lead-generation activities, while coordinating with Sales and other departments to support business objectives."
  },
  {
    "dept": "Pantry",
    "role": "Cook",
    "jd": "Prepare and cook meals, snacks and beverages as per the approved menu while maintaining food quality, hygiene, cleanliness and proper kitchen practices."
  },
  {
    "dept": "Pantry",
    "role": "Cook/Serving",
    "jd": "Assist in food preparation and cooking, serve food and beverages to residents/guests, maintain serving areas and ensure proper hygiene, cleanliness and courteous service."
  },
  {
    "dept": "Project",
    "role": "Assistant MEP Head",
    "jd": "Assist the MEP Head in managing mechanical, electrical and plumbing activities, coordinating teams, monitoring quality and ensuring timely completion of MEP works."
  },
  {
    "dept": "Project",
    "role": "Billing Engineer",
    "jd": "Prepare and verify contractor bills, measurements, quantity calculations and supporting documents as per executed work and approved specifications."
  },
  {
    "dept": "Project",
    "role": "Civil Engineer",
    "jd": "Supervise and coordinate civil construction activities, including structural, masonry, plastering and finishing works, ensuring quality and timely execution."
  },
  {
    "dept": "Project",
    "role": "Computer Oprater",
    "jd": "Handle computer-based data entry, documentation, project records, reports and routine office/ERP-related activities."
  },
  {
    "dept": "Project",
    "role": "ERP OPERATOR Civil",
    "jd": "Maintain civil project data in the ERP system, update work progress, material, measurement and other project-related records accurately."
  },
  {
    "dept": "Project",
    "role": "Electric Engineer",
    "jd": "Supervise electrical installation, testing, maintenance and project works while ensuring compliance with approved drawings, specifications and safety standards."
  },
  {
    "dept": "Project",
    "role": "Electrician",
    "jd": "Install, maintain and repair electrical wiring, lighting, panels, equipment and related systems safely and efficiently."
  },
  {
    "dept": "Project",
    "role": "Formen",
    "jd": "Supervise workers and daily site activities, allocate work, monitor productivity and ensure assigned construction work is completed safely and as per instructions."
  },
  {
    "dept": "Project",
    "role": "JCB Operator",
    "jd": "Operate JCB/excavation equipment safely for digging, loading, leveling and material-handling activities as per site requirements."
  },
  {
    "dept": "Project",
    "role": "Lab Assistant",
    "jd": "Assist the quality/laboratory team with collection, preparation and testing of construction materials and maintain test records and laboratory equipment."
  },
  {
    "dept": "Project",
    "role": "Labour Colony Manager",
    "jd": "Manage labour accommodation, basic facilities, cleanliness, discipline, attendance coordination and day-to-day requirements of the labour colony."
  },
  {
    "dept": "Project",
    "role": "MEP Engineer",
    "jd": "Supervise and coordinate mechanical, electrical and plumbing works, ensuring proper installation, quality, safety and coordination with civil activities."
  },
  {
    "dept": "Project",
    "role": "MEP Head",
    "jd": "Lead overall MEP operations, planning, execution and coordination, ensuring quality, safety, timely completion and proper integration of MEP systems."
  },
  {
    "dept": "Project",
    "role": "Planing",
    "jd": "Prepare and monitor project schedules, track progress, coordinate with project teams and provide regular updates on planned versus actual work."
  },
  {
    "dept": "Project",
    "role": "Project Head",
    "jd": "Provide overall leadership for assigned projects, overseeing planning, execution, cost, quality, safety, timelines and coordination among departments."
  },
  {
    "dept": "Project",
    "role": "Project Manager",
    "jd": "Manage day-to-day project execution, resources, contractors, schedules, quality and safety to ensure timely and efficient project completion."
  },
  {
    "dept": "Project",
    "role": "Quality Billing Engineer",
    "jd": "Verify construction quality and executed quantities while preparing and checking contractor bills, measurements and supporting documentation."
  },
  {
    "dept": "Project",
    "role": "Quality Engineer",
    "jd": "Monitor construction quality, conduct inspections and tests, maintain quality records and ensure work complies with approved drawings and specifications."
  },
  {
    "dept": "Project",
    "role": "STP OPERATOR",
    "jd": "Operate and monitor the Sewage Treatment Plant, maintain equipment and process parameters, record readings and ensure proper treatment operations."
  },
  {
    "dept": "Project",
    "role": "SUPERVISOR ELE",
    "jd": "Supervise electricians and electrical works, coordinate installations and repairs, monitor quality and ensure compliance with electrical safety procedures."
  },
  {
    "dept": "Project",
    "role": "Senior Civil Engineer",
    "jd": "Lead and supervise major civil construction activities, coordinate engineers and contractors, monitor quality, progress and technical compliance."
  },
  {
    "dept": "Project",
    "role": "Senior Foremen",
    "jd": "Supervise multiple work teams and site activities, allocate manpower, monitor productivity and ensure construction work is completed safely and according to plans."
  },
  {
    "dept": "Project",
    "role": "Senior Formen",
    "jd": "Supervise workers and site activities, coordinate daily work execution, monitor workmanship and productivity, and report progress to the Civil Engineer/Project Manager."
  },
  {
    "dept": "Project",
    "role": "Store Helper Civil",
    "jd": "Assist in receiving, arranging, issuing and handling civil construction materials while maintaining cleanliness and supporting proper store management."
  },
  {
    "dept": "Project",
    "role": "Store Incharge",
    "jd": "Manage construction material inventory, receiving, storage and issue of materials while maintaining stock records and coordinating with Purchase and Project teams."
  },
  {
    "dept": "Project",
    "role": "Tower Crane operator",
    "jd": "Operate the tower crane safely for lifting and shifting construction materials, following load limits, signals, safety procedures and site instructions."
  },
  {
    "dept": "Purchase",
    "role": "Assistant Manager",
    "jd": "Supervise procurement activities, evaluate vendors, negotiate prices and terms, review purchase requirements, monitor purchase orders and deliveries, ensure timely availability of materials, and support the Purchase Manager/Head in procurement planning and cost control."
  },
  {
    "dept": "Purchase",
    "role": "Manager",
    "jd": "Manage overall procurement operations, develop and maintain supplier relationships, negotiate major purchases, approve/review purchase orders within authority, monitor procurement schedules, control costs, ensure quality and timely delivery, and coordinate with projects, stores, finance, and management."
  },
  {
    "dept": "Purchase",
    "role": "Purchase Executive",
    "jd": "Handle day-to-day procurement activities, collect quotations, prepare comparative statements, issue purchase orders, coordinate with suppliers, follow up on deliveries, maintain purchase records, and coordinate with stores, accounts, and project teams."
  },
  {
    "dept": "Purchase",
    "role": "Purchase Head",
    "jd": "Lead the complete Purchase/Procurement Department, establish procurement strategies and policies, manage key vendors and contracts, negotiate major/high-value purchases, control procurement costs, ensure uninterrupted material availability, develop the vendor base, monitor departmental performance, and report procurement status to senior management."
  },
  {
    "dept": "Sales",
    "role": "AGM",
    "jd": "Assist in managing the sales department, implement sales strategies, monitor team performance, manage major clients, and support achievement of revenue targets."
  },
  {
    "dept": "Sales",
    "role": "Assistant Manager",
    "jd": "Support sales operations, handle customer inquiries, follow up on leads, assist the sales team, maintain sales records, and achieve assigned targets."
  },
  {
    "dept": "Sales",
    "role": "General Manager",
    "jd": "Manage the overall sales function, develop sales strategies, oversee teams and territories, manage key accounts, and drive revenue and business development."
  },
  {
    "dept": "Sales",
    "role": "Manager",
    "jd": "Manage sales activities, lead the sales team, generate business, handle key customers, monitor sales targets, and prepare sales performance reports."
  },
  {
    "dept": "Sales",
    "role": "Sales Manager",
    "jd": "Manage sales activities, lead the sales team, generate business, handle key customers, monitor sales targets, and prepare sales performance reports."
  },
  {
    "dept": "Sales",
    "role": "Senior Manager",
    "jd": "Oversee multiple sales activities/teams, develop sales strategies, manage key clients, monitor revenue and targets, and drive business growth."
  },
  {
    "dept": "Sales",
    "role": "Vice President",
    "jd": "Provide strategic leadership for the sales function, set revenue objectives, develop market strategies, manage senior sales teams and key accounts, and drive overall business growth."
  }
] as const;

/** IMEI and SIM against the devices already recorded as issued. */
export const GAP_DEVICES = [
  {
    "id": "MB-ACC-0005",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ACC-0002",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "7087402126",
    "returned": false
  },
  {
    "id": "MB-ACC-0006",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ACC-0004",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ACC-0003",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ACC-0001",
    "type": "laptop",
    "model": "Dell",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ADM-0001",
    "type": "Phone",
    "model": "Redmi 14 Pro",
    "imei": "866487074146186",
    "sim": "7087402122",
    "returned": false
  },
  {
    "id": "MB-ADM-0001",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-ADM-0003",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-CRM-0002",
    "type": "Desktop",
    "model": "HP1908W",
    "imei": "",
    "sim": "7087402118",
    "returned": false
  },
  {
    "id": "MB-CRM-0004",
    "type": "Desktop",
    "model": "HP290",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-CRM-0001",
    "type": "Desktop",
    "model": "HPSTG7B5A",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-CRM-0001",
    "type": "Phone",
    "model": "",
    "imei": "",
    "sim": "7087402125",
    "returned": false
  },
  {
    "id": "MB-CRM-0003",
    "type": "Desktop",
    "model": "HP20KD",
    "imei": "",
    "sim": "7087402128",
    "returned": false
  },
  {
    "id": "MB-HR-0001",
    "type": "Laptop",
    "model": "DELL LATITUDE 4410",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-HR-0001",
    "type": "Phone",
    "model": "REDMI 5G",
    "imei": "862554072492526",
    "sim": "7807862014",
    "returned": false
  },
  {
    "id": "MB-IT-0001",
    "type": "Phone",
    "model": "Redmi note 7",
    "imei": "861083056533981",
    "sim": "7087402121/ 9319593195",
    "returned": false
  },
  {
    "id": "MB-IT-0001",
    "type": "Laptop",
    "model": "Dell LATITUDE E5440",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-MNT-0019",
    "type": "Phone",
    "model": "Redmi 13 Pro",
    "imei": "352540120422604",
    "sim": "7888895086",
    "returned": false
  },
  {
    "id": "MB-MNT-0004",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-MNT-0003",
    "type": "LAPTOP",
    "model": "Dell latitude E5540",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-MKT-0002",
    "type": "Desktop",
    "model": "Assembled",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-MKT-0001",
    "type": "Phone",
    "model": "Redmi Note 13 5G",
    "imei": "866083066085662",
    "sim": "7087402120",
    "returned": false
  },
  {
    "id": "MB-MKT-0001",
    "type": "Laptop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0014",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0043",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0028",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0004",
    "type": "Desktop",
    "model": "Assembled",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0008",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0032",
    "type": "DESKTOP",
    "model": "Assembled",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0037",
    "type": "Desktop",
    "model": "Dell",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0044",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0029",
    "type": "DESKTOP",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0031",
    "type": "DESKTOP",
    "model": "Dell (for RMC Plant)",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0034",
    "type": "Laptop",
    "model": "Dell3551 i7",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PRJ-0003",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PUR-0001",
    "type": "Laptop",
    "model": "Dell Latitude E 6440",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PUR-0004",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "7888895286",
    "returned": false
  },
  {
    "id": "MB-PUR-0003",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "",
    "returned": false
  },
  {
    "id": "MB-PUR-0002",
    "type": "Desktop",
    "model": "HP",
    "imei": "",
    "sim": "7087402117",
    "returned": false
  }
] as const;

/** Names the register had wrong. */
export const GAP_RENAMES = [
  {
    "id": "MB-PRJ-0014",
    "was": "Ajay Goyal",
    "now": "Ajay Goel"
  },
  {
    "id": "MB-PRJ-0036",
    "was": "Ravinder Kumar",
    "now": "Ravinder Bawa"
  },
  {
    "id": "MB-PRJ-0057",
    "was": "Sorav",
    "now": "Sourav Alwa"
  },
  {
    "id": "MB-PRJ-0059",
    "was": "Pardeep Yadav",
    "now": "Pardeep Kumar"
  },
  {
    "id": "MB-PRJ-0060",
    "was": "Prem Kumar",
    "now": "Prem Ranjan"
  }
] as const;

/** Titles the register had wrong. */
export const GAP_RETITLED = [
  {
    "id": "MB-MNT-0009",
    "was": "Plunber",
    "now": "Plumber"
  }
] as const;

/** Reserved IDs that turned out to be a second copy of somebody already on the payroll. */
export const GAP_MERGES = [
  {
    "id": "MB-PRJ-0062",
    "name": "Prem Ranjan",
    "into": "MB-PRJ-0060",
    "as": "Prem Ranjan",
    "evidence": "Employee KYC Details sheet only, with Aadhaar, PAN and a current address on file. Absent from the master Employee Details list.",
    "carries": {
      "kind": "kyc",
      "aadhaar": "553732657046",
      "pan": "GVHPR3439G",
      "address": "Sector -83/A,Labour Hutment ship near hdfc office, mohali"
    }
  },
  {
    "id": "MB-PRJ-0063",
    "name": "Ravinder Singh",
    "into": "MB-PRJ-0036",
    "as": "Ravinder Bawa",
    "evidence": "Department Wise Timings, Companies Wise Employee Salary, Department Wise List and the Asset List — which records a device issued to him. Absent from the master Employee Details list.",
    "carries": {
      "kind": "device",
      "type": "Desktop",
      "model": "Assembled",
      "issued": "25 Nov 2025"
    }
  }
] as const;

/** Read these. Nothing here was resolved by the importer. */
export const GAP_CONFLICTS = [
  "2 records share a date of birth AND a mobile number: MB-MNT-0015 (Rahul Kumar Verma, Maintenance, joined 01 Apr 2026), MB-MNT-0017 (Rahul Kumar, Maintenance, joined 01 Apr 2026). Either one person entered twice, or a row copied from the one above it.",
  "2 records share a date of birth AND a mobile number: MB-SAL-0001 (Gurbinder Singh, Sales, joined 07 Jan 2019), MB-PRJ-0017 (Guru Dutt, Project, joined 20 Feb 2020). Either one person entered twice, or a row copied from the one above it.",
  "All 10 holidays are marked \"NO\" under \"Every Site Closed?\", including the three national holidays. Loaded as written, but that is almost certainly the column being read the wrong way round.",
  "MB-PRJ-0004 (Jagmohan Singh): the mobile on file cannot be dialled — it is 11 digits. It was checked off as correct on the sheet.",
  "MB-PRJ-0014 (Ajay Goel): sheet 1 has them reporting to themselves. Taken from sheet 2 instead.",
  "MB-SAL-0007 (Saransh Rao): sheet 1 has them reporting to themselves. Taken from sheet 2 instead.",
  "Project now has two people called Pardeep Kumar: MB-PRJ-0049, MB-PRJ-0059. Correct if they really are two people; say so if they are not.",
  "The same mobile number is on 2 records: MB-CRM-0001 (Kiran Bala), MB-CRM-0004 (Khushi Arora). At most one of them can be right.",
  "The same mobile number is on 2 records: MB-MNT-0015 (Rahul Kumar Verma), MB-MNT-0017 (Rahul Kumar). At most one of them can be right.",
  "The same mobile number is on 2 records: MB-PRJ-0017 (Guru Dutt), MB-SAL-0001 (Gurbinder Singh). At most one of them can be right.",
  "The same personal email is on 2 records: MB-MNT-0003 (Manoj kumar), MB-PUR-0003 (Manoj). A shared address means one of them cannot be reached after they leave."
] as const;

/** Worth knowing, but nothing is blocked on them. */
export const GAP_NOTES = [
  "Admin: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "CRM: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "IT: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "Maintenance: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "Pantry: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "Project: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "Purchase: the weekly off is confirmed but the sheet does not say which day it falls on.",
  "Sales: the weekly off is confirmed but the sheet does not say which day it falls on."
] as const;
