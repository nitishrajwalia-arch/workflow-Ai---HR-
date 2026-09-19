/**
 * Secureye ONtime — Jun 2026, from the attendance machine's own export.
 *
 * Every row is a day the machine recorded. Nothing is filled in for a day it
 * did not: a person who is not on the machine has no rows here rather than
 * thirty blank ones.
 *
 * Regenerate with scripts/import/06-attendance.py — do not hand-edit.
 */

export const ATTENDANCE_SOURCE = "Secureye ONtime \u2014 Jun 2026";

/** The machine's own roll number against the employee ID, matched once by name. */
export const REAL_BIOMETRIC = [
  {
    "code": "4",
    "id": "MB-SAL-0009",
    "machineName": "Twinkle Sharma",
    "why": "name matches exactly"
  },
  {
    "code": "5",
    "id": "MB-PRJ-0029",
    "machineName": "Rohit",
    "why": "only a first name given, and it is unique on the roster"
  },
  {
    "code": "6",
    "id": "MB-ACC-0003",
    "machineName": "Raj Kumar",
    "why": "same name, spelled differently"
  },
  {
    "code": "10",
    "id": "MB-SAL-0008",
    "machineName": "Sourabh Dua",
    "why": "one letter apart, and nobody else is close"
  },
  {
    "code": "15",
    "id": "MB-SAL-0002",
    "machineName": "Inderjiit Kaurr",
    "why": "same name, spelled differently"
  },
  {
    "code": "16",
    "id": "MB-SAL-0001",
    "machineName": "Gurbinder Singh",
    "why": "name matches exactly"
  },
  {
    "code": "23",
    "id": "MB-ACC-0004",
    "machineName": "Rahul Mehta",
    "why": "first and last name match; middle name dropped"
  },
  {
    "code": "26",
    "id": "MB-SAL-0004",
    "machineName": "Manvi Mahajan",
    "why": "name matches exactly"
  },
  {
    "code": "27",
    "id": "MB-CRM-0004",
    "machineName": "Khushi Arora",
    "why": "name matches exactly"
  },
  {
    "code": "42",
    "id": "MB-PRJ-0007",
    "machineName": "Parveen Kumar",
    "why": "name matches exactly"
  },
  {
    "code": "46",
    "id": "MB-SAL-0010",
    "machineName": "Harjot Singh Wazir",
    "why": "name matches exactly"
  },
  {
    "code": "55",
    "id": "MB-IT-0001",
    "machineName": "OM Prakash Singh",
    "why": "name matches exactly"
  },
  {
    "code": "57",
    "id": "MB-CRM-0008",
    "machineName": "Dinesh Kumar",
    "why": "only a first name given, and it is unique on the roster"
  },
  {
    "code": "61",
    "id": "MB-CRM-0003",
    "machineName": "Kushal",
    "why": "only a first name given, and it is unique on the roster"
  },
  {
    "code": "62",
    "id": "MB-PAN-0001",
    "machineName": "Beeru",
    "why": "name matches exactly"
  },
  {
    "code": "72",
    "id": "MB-SAL-0011",
    "machineName": "Himanshu",
    "why": "only a first name given, and it is unique on the roster"
  },
  {
    "code": "75",
    "id": "MB-ADM-0001",
    "machineName": "Baljinder Kaur",
    "why": "name matches exactly"
  },
  {
    "code": "76",
    "id": "MB-ADM-0002",
    "machineName": "Vrainder Kaur",
    "why": "same name, spelled differently"
  },
  {
    "code": "80",
    "id": "MB-SAL-0003",
    "machineName": "Mohit Kakkar",
    "why": "only a first name given, and it is unique on the roster"
  },
  {
    "code": "81",
    "id": "MB-SAL-0006",
    "machineName": "Ravi Dutt Sharma",
    "why": "name matches exactly"
  },
  {
    "code": "82",
    "id": "MB-ACC-0005",
    "machineName": "Akash Sharma",
    "why": "name matches exactly"
  },
  {
    "code": "83",
    "id": "MB-CRM-0002",
    "machineName": "Deepak Panday",
    "why": "one letter apart, and nobody else is close"
  }
] as const;

/** `in` and `out` are null where the machine recorded nothing. */
export const REAL_ATTENDANCE = [
  {
    "personId": "MB-SAL-0009",
    "date": "01 Jun 2026",
    "in": "10:43",
    "out": "18:42"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "02 Jun 2026",
    "in": "10:38",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "03 Jun 2026",
    "in": "10:46",
    "out": "18:43"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "04 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "05 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "06 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "07 Jun 2026",
    "in": "12:42",
    "out": "18:19"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "08 Jun 2026",
    "in": "11:04",
    "out": "18:46"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "09 Jun 2026",
    "in": "10:43",
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "10 Jun 2026",
    "in": "10:45",
    "out": "18:40"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "11 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "12 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "13 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "14 Jun 2026",
    "in": "10:41",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "15 Jun 2026",
    "in": "10:44",
    "out": "18:15"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "16 Jun 2026",
    "in": "10:48",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "17 Jun 2026",
    "in": "10:56",
    "out": "19:06"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "18 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "19 Jun 2026",
    "in": "10:36",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "20 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "21 Jun 2026",
    "in": "11:14",
    "out": "17:58"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "22 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "23 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "24 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "25 Jun 2026",
    "in": "10:50",
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "26 Jun 2026",
    "in": "10:45",
    "out": "18:45"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "27 Jun 2026",
    "in": "10:36",
    "out": "16:41"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "28 Jun 2026",
    "in": "10:41",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0009",
    "date": "29 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0009",
    "date": "30 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "01 Jun 2026",
    "in": "09:38",
    "out": "19:41"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "02 Jun 2026",
    "in": "09:28",
    "out": "19:15"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "03 Jun 2026",
    "in": "09:31",
    "out": "19:25"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "04 Jun 2026",
    "in": "09:20",
    "out": "20:17"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "05 Jun 2026",
    "in": "09:21",
    "out": "19:03"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "06 Jun 2026",
    "in": "09:34",
    "out": "18:54"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "07 Jun 2026",
    "in": "09:33",
    "out": "18:21"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "08 Jun 2026",
    "in": "09:29",
    "out": "19:06"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "10 Jun 2026",
    "in": "09:31",
    "out": "19:13"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "11 Jun 2026",
    "in": "09:31",
    "out": "18:51"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "12 Jun 2026",
    "in": "09:28",
    "out": "18:49"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "13 Jun 2026",
    "in": null,
    "out": "18:55"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "14 Jun 2026",
    "in": "09:39",
    "out": "18:12"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "15 Jun 2026",
    "in": "09:34",
    "out": "19:32"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "16 Jun 2026",
    "in": "09:21",
    "out": "18:54"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "17 Jun 2026",
    "in": "09:30",
    "out": "14:00"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "18 Jun 2026",
    "in": "09:28",
    "out": "19:45"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "19 Jun 2026",
    "in": "09:34",
    "out": "18:46"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "20 Jun 2026",
    "in": "09:28",
    "out": "18:49"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "21 Jun 2026",
    "in": "09:25",
    "out": "18:18"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "22 Jun 2026",
    "in": "09:29",
    "out": "18:36"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "23 Jun 2026",
    "in": "09:22",
    "out": "19:40"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "24 Jun 2026",
    "in": "09:32",
    "out": "18:56"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "25 Jun 2026",
    "in": "09:34",
    "out": "19:31"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "26 Jun 2026",
    "in": "09:25",
    "out": "18:56"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "27 Jun 2026",
    "in": "09:32",
    "out": "19:27"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "28 Jun 2026",
    "in": "09:46",
    "out": "18:05"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "29 Jun 2026",
    "in": "09:31",
    "out": "19:05"
  },
  {
    "personId": "MB-PRJ-0029",
    "date": "30 Jun 2026",
    "in": "09:28",
    "out": "19:58"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "01 Jun 2026",
    "in": "10:03",
    "out": "18:57"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "02 Jun 2026",
    "in": "11:34",
    "out": "18:58"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "03 Jun 2026",
    "in": "09:55",
    "out": "18:31"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "04 Jun 2026",
    "in": "09:42",
    "out": "18:42"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "05 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0003",
    "date": "06 Jun 2026",
    "in": "09:56",
    "out": "18:47"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "07 Jun 2026",
    "in": "10:12",
    "out": "18:02"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "08 Jun 2026",
    "in": null,
    "out": "17:27"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "09 Jun 2026",
    "in": "09:48",
    "out": "18:00"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "10 Jun 2026",
    "in": "09:53",
    "out": "18:54"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "11 Jun 2026",
    "in": "10:01",
    "out": "18:34"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "12 Jun 2026",
    "in": "10:03",
    "out": "18:37"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "13 Jun 2026",
    "in": "09:56",
    "out": "19:07"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "14 Jun 2026",
    "in": "10:31",
    "out": "18:07"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "15 Jun 2026",
    "in": "09:57",
    "out": "18:49"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "16 Jun 2026",
    "in": "10:01",
    "out": "18:36"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "17 Jun 2026",
    "in": "10:01",
    "out": null
  },
  {
    "personId": "MB-ACC-0003",
    "date": "18 Jun 2026",
    "in": "11:59",
    "out": "18:59"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "19 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0003",
    "date": "20 Jun 2026",
    "in": "10:26",
    "out": "18:45"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "21 Jun 2026",
    "in": "10:29",
    "out": "18:02"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "22 Jun 2026",
    "in": "10:25",
    "out": "18:33"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "23 Jun 2026",
    "in": "10:01",
    "out": "18:33"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "24 Jun 2026",
    "in": "10:15",
    "out": "18:35"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "25 Jun 2026",
    "in": "10:04",
    "out": "18:32"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0003",
    "date": "27 Jun 2026",
    "in": "09:59",
    "out": "18:41"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "28 Jun 2026",
    "in": "10:31",
    "out": "18:03"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "29 Jun 2026",
    "in": "10:00",
    "out": "18:36"
  },
  {
    "personId": "MB-ACC-0003",
    "date": "30 Jun 2026",
    "in": "10:00",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "03 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "04 Jun 2026",
    "in": null,
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "05 Jun 2026",
    "in": "10:53",
    "out": "18:32"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "06 Jun 2026",
    "in": "11:17",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "07 Jun 2026",
    "in": "10:51",
    "out": "18:16"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "08 Jun 2026",
    "in": "11:03",
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "09 Jun 2026",
    "in": "10:59",
    "out": "18:51"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "10 Jun 2026",
    "in": "11:07",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "11 Jun 2026",
    "in": "11:07",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "12 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "13 Jun 2026",
    "in": "10:57",
    "out": "18:37"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "14 Jun 2026",
    "in": "12:32",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "15 Jun 2026",
    "in": "10:55",
    "out": "15:45"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "17 Jun 2026",
    "in": "10:48",
    "out": "19:15"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "18 Jun 2026",
    "in": "10:45",
    "out": "19:00"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "19 Jun 2026",
    "in": "10:47",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "20 Jun 2026",
    "in": "10:57",
    "out": "18:40"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "21 Jun 2026",
    "in": "10:44",
    "out": "18:03"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "22 Jun 2026",
    "in": "10:40",
    "out": "19:13"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "23 Jun 2026",
    "in": "11:00",
    "out": "18:47"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "24 Jun 2026",
    "in": "11:15",
    "out": "18:23"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "25 Jun 2026",
    "in": "11:08",
    "out": "18:50"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0008",
    "date": "27 Jun 2026",
    "in": "11:05",
    "out": "18:21"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "28 Jun 2026",
    "in": "10:56",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "29 Jun 2026",
    "in": "10:46",
    "out": "18:28"
  },
  {
    "personId": "MB-SAL-0008",
    "date": "30 Jun 2026",
    "in": "11:00",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "01 Jun 2026",
    "in": "09:59",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "02 Jun 2026",
    "in": "10:18",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "03 Jun 2026",
    "in": "11:53",
    "out": "16:02"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "04 Jun 2026",
    "in": "10:23",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "05 Jun 2026",
    "in": "10:22",
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "06 Jun 2026",
    "in": "10:57",
    "out": null
  },
  {
    "personId": "MB-SAL-0002",
    "date": "07 Jun 2026",
    "in": null,
    "out": "18:02"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "08 Jun 2026",
    "in": "10:46",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "09 Jun 2026",
    "in": "10:08",
    "out": "19:34"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "10 Jun 2026",
    "in": "10:44",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "11 Jun 2026",
    "in": null,
    "out": "18:47"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "12 Jun 2026",
    "in": "10:41",
    "out": "17:53"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "13 Jun 2026",
    "in": "10:52",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "14 Jun 2026",
    "in": null,
    "out": "18:08"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "15 Jun 2026",
    "in": "12:29",
    "out": null
  },
  {
    "personId": "MB-SAL-0002",
    "date": "16 Jun 2026",
    "in": "10:19",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "17 Jun 2026",
    "in": "10:23",
    "out": "18:56"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "18 Jun 2026",
    "in": "10:18",
    "out": "18:40"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "19 Jun 2026",
    "in": "10:26",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "20 Jun 2026",
    "in": "10:52",
    "out": "18:41"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "21 Jun 2026",
    "in": "10:35",
    "out": "18:03"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "22 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0002",
    "date": "23 Jun 2026",
    "in": "10:44",
    "out": "18:43"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "24 Jun 2026",
    "in": "12:04",
    "out": "18:37"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "25 Jun 2026",
    "in": "10:56",
    "out": "16:08"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "26 Jun 2026",
    "in": "10:12",
    "out": "18:43"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "27 Jun 2026",
    "in": "10:41",
    "out": "18:21"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "28 Jun 2026",
    "in": "09:57",
    "out": "18:02"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "29 Jun 2026",
    "in": "10:12",
    "out": "18:21"
  },
  {
    "personId": "MB-SAL-0002",
    "date": "30 Jun 2026",
    "in": "10:33",
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "02 Jun 2026",
    "in": "10:21",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0001",
    "date": "03 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "04 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "05 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "06 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "10 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "11 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "12 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "13 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "15 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "17 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "18 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "19 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "20 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "21 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "22 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "23 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "24 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "25 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "27 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "28 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "29 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0001",
    "date": "30 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0004",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0004",
    "date": "02 Jun 2026",
    "in": "10:17",
    "out": "19:21"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "03 Jun 2026",
    "in": "10:37",
    "out": "19:07"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "04 Jun 2026",
    "in": "10:36",
    "out": "20:17"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "05 Jun 2026",
    "in": "10:29",
    "out": "19:02"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "06 Jun 2026",
    "in": "10:39",
    "out": "18:51"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "07 Jun 2026",
    "in": "10:30",
    "out": "18:37"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "08 Jun 2026",
    "in": "10:39",
    "out": "19:09"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "09 Jun 2026",
    "in": "10:36",
    "out": "19:04"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "10 Jun 2026",
    "in": "10:20",
    "out": "19:19"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "11 Jun 2026",
    "in": "10:33",
    "out": "18:53"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "12 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0004",
    "date": "13 Jun 2026",
    "in": "10:37",
    "out": "18:57"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "14 Jun 2026",
    "in": "10:37",
    "out": "18:17"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "15 Jun 2026",
    "in": "12:19",
    "out": "19:31"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "16 Jun 2026",
    "in": "10:33",
    "out": "18:54"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "17 Jun 2026",
    "in": "10:43",
    "out": "20:50"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "18 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0004",
    "date": "19 Jun 2026",
    "in": "10:43",
    "out": "18:46"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "20 Jun 2026",
    "in": "10:33",
    "out": "18:49"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "21 Jun 2026",
    "in": "10:38",
    "out": "18:17"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "22 Jun 2026",
    "in": "12:12",
    "out": "18:38"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "23 Jun 2026",
    "in": "10:30",
    "out": "19:39"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "24 Jun 2026",
    "in": "10:40",
    "out": "18:55"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "25 Jun 2026",
    "in": "10:44",
    "out": "19:31"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "26 Jun 2026",
    "in": "10:34",
    "out": "18:56"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "27 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0004",
    "date": "28 Jun 2026",
    "in": "10:38",
    "out": "18:04"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "29 Jun 2026",
    "in": "10:43",
    "out": "19:05"
  },
  {
    "personId": "MB-ACC-0004",
    "date": "30 Jun 2026",
    "in": "10:27",
    "out": "19:18"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "02 Jun 2026",
    "in": "10:34",
    "out": "18:32"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "03 Jun 2026",
    "in": "10:40",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "04 Jun 2026",
    "in": "10:41",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "05 Jun 2026",
    "in": "10:38",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "06 Jun 2026",
    "in": "10:39",
    "out": "18:32"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "07 Jun 2026",
    "in": "10:44",
    "out": "18:02"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "09 Jun 2026",
    "in": "10:30",
    "out": "18:47"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "10 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "11 Jun 2026",
    "in": "10:34",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "12 Jun 2026",
    "in": "10:44",
    "out": "18:33"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "13 Jun 2026",
    "in": "10:48",
    "out": "18:56"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "14 Jun 2026",
    "in": "10:37",
    "out": "18:09"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "15 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "16 Jun 2026",
    "in": "10:47",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "17 Jun 2026",
    "in": "10:39",
    "out": "18:54"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "18 Jun 2026",
    "in": "10:48",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "19 Jun 2026",
    "in": "10:36",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "20 Jun 2026",
    "in": "10:40",
    "out": "18:33"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "21 Jun 2026",
    "in": "10:35",
    "out": "18:09"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "22 Jun 2026",
    "in": "10:36",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "23 Jun 2026",
    "in": "10:41",
    "out": "18:55"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "24 Jun 2026",
    "in": "10:46",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "25 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "27 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0004",
    "date": "28 Jun 2026",
    "in": "10:40",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "29 Jun 2026",
    "in": "10:43",
    "out": "18:29"
  },
  {
    "personId": "MB-SAL-0004",
    "date": "30 Jun 2026",
    "in": "10:09",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "01 Jun 2026",
    "in": "10:33",
    "out": "18:46"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "02 Jun 2026",
    "in": "10:31",
    "out": "18:51"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "03 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "04 Jun 2026",
    "in": "10:28",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "05 Jun 2026",
    "in": "10:27",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "06 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "10 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "11 Jun 2026",
    "in": "10:33",
    "out": "18:38"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "12 Jun 2026",
    "in": "10:33",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "13 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "15 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "17 Jun 2026",
    "in": "10:39",
    "out": "18:35"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "18 Jun 2026",
    "in": "10:30",
    "out": "18:43"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "19 Jun 2026",
    "in": "10:32",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "20 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "21 Jun 2026",
    "in": "10:22",
    "out": "18:04"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "22 Jun 2026",
    "in": "10:41",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "23 Jun 2026",
    "in": "10:31",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "24 Jun 2026",
    "in": "10:35",
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "25 Jun 2026",
    "in": "10:34",
    "out": "18:50"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "26 Jun 2026",
    "in": "10:36",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "27 Jun 2026",
    "in": "10:29",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "28 Jun 2026",
    "in": "10:30",
    "out": "18:02"
  },
  {
    "personId": "MB-CRM-0004",
    "date": "29 Jun 2026",
    "in": "10:13",
    "out": null
  },
  {
    "personId": "MB-CRM-0004",
    "date": "30 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "01 Jun 2026",
    "in": "09:48",
    "out": "18:39"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "03 Jun 2026",
    "in": "09:48",
    "out": "18:31"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "04 Jun 2026",
    "in": "09:45",
    "out": "18:44"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "05 Jun 2026",
    "in": "09:45",
    "out": "18:33"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "06 Jun 2026",
    "in": "09:46",
    "out": "18:35"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "08 Jun 2026",
    "in": "09:49",
    "out": "18:40"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "09 Jun 2026",
    "in": "09:46",
    "out": "18:34"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "10 Jun 2026",
    "in": "09:46",
    "out": "18:38"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "11 Jun 2026",
    "in": null,
    "out": "18:34"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "12 Jun 2026",
    "in": "09:46",
    "out": "18:34"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "13 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "15 Jun 2026",
    "in": "09:26",
    "out": "18:40"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "16 Jun 2026",
    "in": null,
    "out": "18:32"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "17 Jun 2026",
    "in": "09:46",
    "out": "18:30"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "18 Jun 2026",
    "in": "09:47",
    "out": "16:01"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "19 Jun 2026",
    "in": "09:49",
    "out": "18:41"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "20 Jun 2026",
    "in": "09:49",
    "out": "18:33"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "21 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "22 Jun 2026",
    "in": "09:41",
    "out": "18:33"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "23 Jun 2026",
    "in": "09:44",
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "24 Jun 2026",
    "in": "09:43",
    "out": "18:35"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "25 Jun 2026",
    "in": null,
    "out": "18:33"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "26 Jun 2026",
    "in": "09:49",
    "out": "18:32"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "27 Jun 2026",
    "in": "09:46",
    "out": "18:41"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "28 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "29 Jun 2026",
    "in": "09:46",
    "out": "18:33"
  },
  {
    "personId": "MB-PRJ-0007",
    "date": "30 Jun 2026",
    "in": "09:36",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "01 Jun 2026",
    "in": "11:00",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "03 Jun 2026",
    "in": "11:16",
    "out": "18:52"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "04 Jun 2026",
    "in": "11:07",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "05 Jun 2026",
    "in": null,
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "06 Jun 2026",
    "in": "11:12",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "07 Jun 2026",
    "in": null,
    "out": "18:13"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "08 Jun 2026",
    "in": null,
    "out": "18:46"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "10 Jun 2026",
    "in": "10:58",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "11 Jun 2026",
    "in": "11:15",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "12 Jun 2026",
    "in": "13:54",
    "out": "18:51"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "13 Jun 2026",
    "in": "11:08",
    "out": "19:57"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "14 Jun 2026",
    "in": "11:10",
    "out": "18:06"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "15 Jun 2026",
    "in": "11:12",
    "out": "18:33"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "17 Jun 2026",
    "in": "11:08",
    "out": "19:28"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "18 Jun 2026",
    "in": "11:02",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "19 Jun 2026",
    "in": "11:13",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "20 Jun 2026",
    "in": "11:06",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "21 Jun 2026",
    "in": "11:02",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "22 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "23 Jun 2026",
    "in": "11:04",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "24 Jun 2026",
    "in": "12:59",
    "out": "18:43"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "25 Jun 2026",
    "in": null,
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "27 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0010",
    "date": "28 Jun 2026",
    "in": "11:06",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "29 Jun 2026",
    "in": null,
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0010",
    "date": "30 Jun 2026",
    "in": null,
    "out": "18:42"
  },
  {
    "personId": "MB-IT-0001",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-IT-0001",
    "date": "02 Jun 2026",
    "in": "10:51",
    "out": "18:50"
  },
  {
    "personId": "MB-IT-0001",
    "date": "03 Jun 2026",
    "in": "10:41",
    "out": "19:07"
  },
  {
    "personId": "MB-IT-0001",
    "date": "04 Jun 2026",
    "in": "10:48",
    "out": "18:47"
  },
  {
    "personId": "MB-IT-0001",
    "date": "05 Jun 2026",
    "in": "10:44",
    "out": "18:47"
  },
  {
    "personId": "MB-IT-0001",
    "date": "06 Jun 2026",
    "in": "10:53",
    "out": "18:40"
  },
  {
    "personId": "MB-IT-0001",
    "date": "07 Jun 2026",
    "in": "10:35",
    "out": "18:08"
  },
  {
    "personId": "MB-IT-0001",
    "date": "08 Jun 2026",
    "in": "10:21",
    "out": "19:16"
  },
  {
    "personId": "MB-IT-0001",
    "date": "09 Jun 2026",
    "in": "10:36",
    "out": "18:42"
  },
  {
    "personId": "MB-IT-0001",
    "date": "10 Jun 2026",
    "in": "10:23",
    "out": "19:10"
  },
  {
    "personId": "MB-IT-0001",
    "date": "11 Jun 2026",
    "in": "10:42",
    "out": "18:51"
  },
  {
    "personId": "MB-IT-0001",
    "date": "12 Jun 2026",
    "in": "10:59",
    "out": "18:57"
  },
  {
    "personId": "MB-IT-0001",
    "date": "13 Jun 2026",
    "in": "10:35",
    "out": "18:32"
  },
  {
    "personId": "MB-IT-0001",
    "date": "14 Jun 2026",
    "in": "11:14",
    "out": "18:12"
  },
  {
    "personId": "MB-IT-0001",
    "date": "15 Jun 2026",
    "in": "10:13",
    "out": "18:38"
  },
  {
    "personId": "MB-IT-0001",
    "date": "16 Jun 2026",
    "in": "10:31",
    "out": "18:53"
  },
  {
    "personId": "MB-IT-0001",
    "date": "17 Jun 2026",
    "in": "10:57",
    "out": "18:44"
  },
  {
    "personId": "MB-IT-0001",
    "date": "18 Jun 2026",
    "in": "10:31",
    "out": "18:45"
  },
  {
    "personId": "MB-IT-0001",
    "date": "19 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-IT-0001",
    "date": "20 Jun 2026",
    "in": "10:28",
    "out": "18:42"
  },
  {
    "personId": "MB-IT-0001",
    "date": "21 Jun 2026",
    "in": "10:57",
    "out": "18:26"
  },
  {
    "personId": "MB-IT-0001",
    "date": "22 Jun 2026",
    "in": "10:50",
    "out": "18:56"
  },
  {
    "personId": "MB-IT-0001",
    "date": "23 Jun 2026",
    "in": "10:33",
    "out": "18:38"
  },
  {
    "personId": "MB-IT-0001",
    "date": "24 Jun 2026",
    "in": "10:28",
    "out": "18:43"
  },
  {
    "personId": "MB-IT-0001",
    "date": "25 Jun 2026",
    "in": "11:46",
    "out": "18:31"
  },
  {
    "personId": "MB-IT-0001",
    "date": "26 Jun 2026",
    "in": "10:46",
    "out": "18:31"
  },
  {
    "personId": "MB-IT-0001",
    "date": "27 Jun 2026",
    "in": "10:35",
    "out": "18:35"
  },
  {
    "personId": "MB-IT-0001",
    "date": "28 Jun 2026",
    "in": "11:02",
    "out": "18:16"
  },
  {
    "personId": "MB-IT-0001",
    "date": "29 Jun 2026",
    "in": "10:52",
    "out": "18:55"
  },
  {
    "personId": "MB-IT-0001",
    "date": "30 Jun 2026",
    "in": "10:39",
    "out": "18:55"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "02 Jun 2026",
    "in": "10:45",
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "03 Jun 2026",
    "in": "10:14",
    "out": "18:45"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "04 Jun 2026",
    "in": "10:48",
    "out": "18:51"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "05 Jun 2026",
    "in": "10:44",
    "out": "18:45"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "06 Jun 2026",
    "in": "10:15",
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "10 Jun 2026",
    "in": "11:50",
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "11 Jun 2026",
    "in": "10:42",
    "out": "18:38"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "12 Jun 2026",
    "in": "10:23",
    "out": "18:40"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "13 Jun 2026",
    "in": "12:00",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "15 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "17 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "18 Jun 2026",
    "in": "10:36",
    "out": "18:49"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "19 Jun 2026",
    "in": "10:20",
    "out": "18:40"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "20 Jun 2026",
    "in": "10:24",
    "out": "18:42"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "21 Jun 2026",
    "in": "10:23",
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "22 Jun 2026",
    "in": "10:36",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "23 Jun 2026",
    "in": "10:35",
    "out": null
  },
  {
    "personId": "MB-CRM-0008",
    "date": "24 Jun 2026",
    "in": "10:45",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "25 Jun 2026",
    "in": "10:33",
    "out": "18:46"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "26 Jun 2026",
    "in": "10:31",
    "out": "18:38"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "27 Jun 2026",
    "in": "10:20",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "28 Jun 2026",
    "in": "10:25",
    "out": "16:39"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "29 Jun 2026",
    "in": "10:14",
    "out": "18:42"
  },
  {
    "personId": "MB-CRM-0008",
    "date": "30 Jun 2026",
    "in": "10:12",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "01 Jun 2026",
    "in": "10:43",
    "out": "16:03"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "02 Jun 2026",
    "in": "12:10",
    "out": "18:37"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "03 Jun 2026",
    "in": "10:37",
    "out": "18:30"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "04 Jun 2026",
    "in": "10:28",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "05 Jun 2026",
    "in": "12:20",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "06 Jun 2026",
    "in": "10:43",
    "out": "18:30"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-CRM-0003",
    "date": "08 Jun 2026",
    "in": "10:26",
    "out": "18:46"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "09 Jun 2026",
    "in": "13:06",
    "out": "18:37"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "10 Jun 2026",
    "in": "12:58",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "11 Jun 2026",
    "in": "11:49",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "12 Jun 2026",
    "in": "11:47",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "13 Jun 2026",
    "in": "10:42",
    "out": "18:30"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "14 Jun 2026",
    "in": "10:35",
    "out": "18:02"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "15 Jun 2026",
    "in": "10:35",
    "out": "18:35"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "16 Jun 2026",
    "in": "12:48",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "17 Jun 2026",
    "in": "12:03",
    "out": "18:41"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "18 Jun 2026",
    "in": "10:42",
    "out": "18:43"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "19 Jun 2026",
    "in": "14:53",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "20 Jun 2026",
    "in": "10:42",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "21 Jun 2026",
    "in": "10:22",
    "out": "18:04"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "22 Jun 2026",
    "in": "10:49",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "23 Jun 2026",
    "in": "10:45",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "24 Jun 2026",
    "in": "12:18",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "25 Jun 2026",
    "in": "12:27",
    "out": "18:50"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "26 Jun 2026",
    "in": "10:36",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "27 Jun 2026",
    "in": "10:29",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "28 Jun 2026",
    "in": "10:14",
    "out": "18:02"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "29 Jun 2026",
    "in": "12:23",
    "out": "18:35"
  },
  {
    "personId": "MB-CRM-0003",
    "date": "30 Jun 2026",
    "in": "12:38",
    "out": "18:30"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "01 Jun 2026",
    "in": "10:07",
    "out": "19:03"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "02 Jun 2026",
    "in": "10:23",
    "out": "18:34"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "03 Jun 2026",
    "in": "10:13",
    "out": "18:44"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "04 Jun 2026",
    "in": "10:14",
    "out": "18:15"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "05 Jun 2026",
    "in": "10:21",
    "out": "18:33"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "06 Jun 2026",
    "in": "10:23",
    "out": "18:08"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "07 Jun 2026",
    "in": "10:19",
    "out": "14:40"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PAN-0001",
    "date": "09 Jun 2026",
    "in": "10:10",
    "out": "18:15"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "10 Jun 2026",
    "in": "10:30",
    "out": "18:28"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "11 Jun 2026",
    "in": "10:29",
    "out": "18:06"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "12 Jun 2026",
    "in": "10:23",
    "out": "18:42"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "13 Jun 2026",
    "in": "10:27",
    "out": null
  },
  {
    "personId": "MB-PAN-0001",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PAN-0001",
    "date": "15 Jun 2026",
    "in": "10:37",
    "out": "18:30"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "16 Jun 2026",
    "in": "10:24",
    "out": "17:58"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "17 Jun 2026",
    "in": "10:22",
    "out": "18:12"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "18 Jun 2026",
    "in": "10:29",
    "out": "18:45"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "19 Jun 2026",
    "in": "11:30",
    "out": "18:32"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "20 Jun 2026",
    "in": "10:49",
    "out": "17:07"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "21 Jun 2026",
    "in": "10:51",
    "out": "16:35"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "22 Jun 2026",
    "in": "10:21",
    "out": "18:42"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "23 Jun 2026",
    "in": "10:20",
    "out": null
  },
  {
    "personId": "MB-PAN-0001",
    "date": "24 Jun 2026",
    "in": "10:31",
    "out": "18:23"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "25 Jun 2026",
    "in": "10:54",
    "out": "18:12"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "26 Jun 2026",
    "in": "10:24",
    "out": "18:15"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "27 Jun 2026",
    "in": "10:40",
    "out": "18:30"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "28 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-PAN-0001",
    "date": "29 Jun 2026",
    "in": "10:15",
    "out": "17:17"
  },
  {
    "personId": "MB-PAN-0001",
    "date": "30 Jun 2026",
    "in": "10:28",
    "out": "18:45"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "01 Jun 2026",
    "in": "12:36",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "03 Jun 2026",
    "in": null,
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "04 Jun 2026",
    "in": "10:52",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "05 Jun 2026",
    "in": "11:23",
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "06 Jun 2026",
    "in": "11:01",
    "out": "18:55"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "10 Jun 2026",
    "in": null,
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "11 Jun 2026",
    "in": "10:54",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "12 Jun 2026",
    "in": "11:01",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "13 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "14 Jun 2026",
    "in": "10:54",
    "out": "18:08"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "15 Jun 2026",
    "in": null,
    "out": "18:33"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "16 Jun 2026",
    "in": null,
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "17 Jun 2026",
    "in": "10:55",
    "out": "18:50"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "18 Jun 2026",
    "in": null,
    "out": "18:41"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "19 Jun 2026",
    "in": "10:54",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "20 Jun 2026",
    "in": "11:00",
    "out": "18:33"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "21 Jun 2026",
    "in": "11:06",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "22 Jun 2026",
    "in": "12:35",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "23 Jun 2026",
    "in": "10:46",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "24 Jun 2026",
    "in": null,
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "25 Jun 2026",
    "in": "10:59",
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "26 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "27 Jun 2026",
    "in": "10:59",
    "out": null
  },
  {
    "personId": "MB-SAL-0011",
    "date": "28 Jun 2026",
    "in": "11:08",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "29 Jun 2026",
    "in": "11:03",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0011",
    "date": "30 Jun 2026",
    "in": null,
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "01 Jun 2026",
    "in": "10:38",
    "out": "18:35"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "02 Jun 2026",
    "in": "12:18",
    "out": "18:32"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "03 Jun 2026",
    "in": "10:26",
    "out": "18:38"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "04 Jun 2026",
    "in": "10:29",
    "out": "18:30"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "05 Jun 2026",
    "in": "10:34",
    "out": "18:32"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "06 Jun 2026",
    "in": "10:38",
    "out": null
  },
  {
    "personId": "MB-ADM-0001",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ADM-0001",
    "date": "08 Jun 2026",
    "in": "10:54",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ADM-0001",
    "date": "10 Jun 2026",
    "in": "10:38",
    "out": "18:37"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "11 Jun 2026",
    "in": "10:32",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "12 Jun 2026",
    "in": "10:32",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "13 Jun 2026",
    "in": "10:32",
    "out": "18:32"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "14 Jun 2026",
    "in": "10:29",
    "out": "18:04"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "15 Jun 2026",
    "in": "10:42",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "16 Jun 2026",
    "in": "10:36",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "17 Jun 2026",
    "in": "10:33",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "18 Jun 2026",
    "in": "10:39",
    "out": "18:39"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "19 Jun 2026",
    "in": "10:45",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "20 Jun 2026",
    "in": "10:25",
    "out": "18:30"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "21 Jun 2026",
    "in": "10:23",
    "out": "14:32"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "22 Jun 2026",
    "in": "10:29",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "23 Jun 2026",
    "in": "10:35",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "24 Jun 2026",
    "in": "10:32",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "25 Jun 2026",
    "in": "10:32",
    "out": "18:01"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "26 Jun 2026",
    "in": "10:52",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "27 Jun 2026",
    "in": "10:39",
    "out": "18:27"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "28 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ADM-0001",
    "date": "29 Jun 2026",
    "in": "11:18",
    "out": "18:29"
  },
  {
    "personId": "MB-ADM-0001",
    "date": "30 Jun 2026",
    "in": "10:26",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "01 Jun 2026",
    "in": "10:38",
    "out": "18:35"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "02 Jun 2026",
    "in": "10:19",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "03 Jun 2026",
    "in": "10:26",
    "out": "18:39"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "04 Jun 2026",
    "in": "10:29",
    "out": "16:46"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "05 Jun 2026",
    "in": "10:34",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "06 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ADM-0002",
    "date": "07 Jun 2026",
    "in": "10:26",
    "out": "18:02"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "08 Jun 2026",
    "in": "10:28",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "09 Jun 2026",
    "in": "10:19",
    "out": "18:48"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "10 Jun 2026",
    "in": "10:22",
    "out": "18:37"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "11 Jun 2026",
    "in": "10:15",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "12 Jun 2026",
    "in": "10:18",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "13 Jun 2026",
    "in": "10:15",
    "out": "18:32"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "14 Jun 2026",
    "in": "10:19",
    "out": "18:04"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "15 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ADM-0002",
    "date": "16 Jun 2026",
    "in": "10:28",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "17 Jun 2026",
    "in": "10:33",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "18 Jun 2026",
    "in": "10:20",
    "out": "16:36"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "19 Jun 2026",
    "in": "10:30",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "20 Jun 2026",
    "in": "10:19",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "21 Jun 2026",
    "in": "10:13",
    "out": "18:09"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "22 Jun 2026",
    "in": "10:19",
    "out": "18:31"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "23 Jun 2026",
    "in": "10:19",
    "out": "18:33"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "24 Jun 2026",
    "in": "10:16",
    "out": "16:34"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "25 Jun 2026",
    "in": "10:11",
    "out": "18:32"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "26 Jun 2026",
    "in": "10:16",
    "out": "18:34"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "27 Jun 2026",
    "in": "10:29",
    "out": "18:27"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "28 Jun 2026",
    "in": "10:17",
    "out": "18:02"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "29 Jun 2026",
    "in": "10:24",
    "out": "18:28"
  },
  {
    "personId": "MB-ADM-0002",
    "date": "30 Jun 2026",
    "in": "10:30",
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "03 Jun 2026",
    "in": "10:45",
    "out": "18:41"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "04 Jun 2026",
    "in": "10:31",
    "out": "18:31"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "05 Jun 2026",
    "in": "10:15",
    "out": "18:32"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "06 Jun 2026",
    "in": "10:13",
    "out": "18:56"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "07 Jun 2026",
    "in": "10:16",
    "out": "18:02"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "09 Jun 2026",
    "in": "10:11",
    "out": "18:55"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "10 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "11 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "12 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "13 Jun 2026",
    "in": "10:19",
    "out": "18:56"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "14 Jun 2026",
    "in": "11:11",
    "out": "18:08"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "15 Jun 2026",
    "in": "10:43",
    "out": "19:03"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "16 Jun 2026",
    "in": "10:51",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "17 Jun 2026",
    "in": "10:13",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "18 Jun 2026",
    "in": "10:31",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "19 Jun 2026",
    "in": "10:31",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "20 Jun 2026",
    "in": null,
    "out": "18:40"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "21 Jun 2026",
    "in": "10:42",
    "out": "18:01"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "22 Jun 2026",
    "in": "10:40",
    "out": "18:50"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "23 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0003",
    "date": "24 Jun 2026",
    "in": "10:44",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "25 Jun 2026",
    "in": "11:06",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "26 Jun 2026",
    "in": "10:38",
    "out": "16:23"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "27 Jun 2026",
    "in": "10:42",
    "out": "18:24"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "28 Jun 2026",
    "in": "11:20",
    "out": "18:04"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "29 Jun 2026",
    "in": "10:24",
    "out": "18:27"
  },
  {
    "personId": "MB-SAL-0003",
    "date": "30 Jun 2026",
    "in": "10:41",
    "out": "16:09"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "01 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "02 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "03 Jun 2026",
    "in": "10:47",
    "out": "18:39"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "04 Jun 2026",
    "in": "10:44",
    "out": "18:38"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "05 Jun 2026",
    "in": "10:53",
    "out": "18:30"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "06 Jun 2026",
    "in": "10:57",
    "out": "18:36"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "07 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "08 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "09 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "10 Jun 2026",
    "in": "10:51",
    "out": "18:37"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "11 Jun 2026",
    "in": "12:43",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "12 Jun 2026",
    "in": "10:53",
    "out": "18:08"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "13 Jun 2026",
    "in": "10:54",
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "14 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "15 Jun 2026",
    "in": "10:45",
    "out": "18:35"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "16 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "17 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "18 Jun 2026",
    "in": "10:50",
    "out": "18:13"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "19 Jun 2026",
    "in": "10:48",
    "out": "16:08"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "20 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "21 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "22 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "23 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "24 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "25 Jun 2026",
    "in": null,
    "out": "18:50"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "26 Jun 2026",
    "in": "10:54",
    "out": "19:03"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "27 Jun 2026",
    "in": "10:41",
    "out": "18:34"
  },
  {
    "personId": "MB-SAL-0006",
    "date": "28 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "29 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-SAL-0006",
    "date": "30 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0005",
    "date": "01 Jun 2026",
    "in": "10:52",
    "out": null
  },
  {
    "personId": "MB-ACC-0005",
    "date": "02 Jun 2026",
    "in": "10:45",
    "out": "19:12"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "03 Jun 2026",
    "in": "10:45",
    "out": "19:25"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "04 Jun 2026",
    "in": "10:49",
    "out": "21:29"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "05 Jun 2026",
    "in": "10:39",
    "out": "19:02"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "06 Jun 2026",
    "in": "13:03",
    "out": "18:55"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "07 Jun 2026",
    "in": "10:43",
    "out": "18:21"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "08 Jun 2026",
    "in": null,
    "out": "19:06"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "09 Jun 2026",
    "in": "11:32",
    "out": "18:57"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "10 Jun 2026",
    "in": "10:46",
    "out": "19:19"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "11 Jun 2026",
    "in": "10:43",
    "out": "18:51"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "12 Jun 2026",
    "in": "11:18",
    "out": "18:43"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "13 Jun 2026",
    "in": "12:08",
    "out": "18:55"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "14 Jun 2026",
    "in": "10:57",
    "out": "18:11"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "15 Jun 2026",
    "in": "10:39",
    "out": "19:31"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "16 Jun 2026",
    "in": "10:53",
    "out": "19:07"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "17 Jun 2026",
    "in": "19:10",
    "out": "19:12"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "18 Jun 2026",
    "in": null,
    "out": "19:43"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "19 Jun 2026",
    "in": "12:34",
    "out": "18:46"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "20 Jun 2026",
    "in": "11:02",
    "out": "20:25"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "21 Jun 2026",
    "in": "10:44",
    "out": "18:17"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "22 Jun 2026",
    "in": null,
    "out": "18:36"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "23 Jun 2026",
    "in": "10:56",
    "out": "19:42"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "24 Jun 2026",
    "in": "11:13",
    "out": "18:54"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "25 Jun 2026",
    "in": null,
    "out": null
  },
  {
    "personId": "MB-ACC-0005",
    "date": "26 Jun 2026",
    "in": null,
    "out": "18:56"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "27 Jun 2026",
    "in": null,
    "out": "19:26"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "28 Jun 2026",
    "in": "13:44",
    "out": null
  },
  {
    "personId": "MB-ACC-0005",
    "date": "29 Jun 2026",
    "in": null,
    "out": "18:47"
  },
  {
    "personId": "MB-ACC-0005",
    "date": "30 Jun 2026",
    "in": "11:09",
    "out": "19:58"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "01 Jun 2026",
    "in": "11:00",
    "out": "18:48"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "02 Jun 2026",
    "in": "10:31",
    "out": "18:37"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "03 Jun 2026",
    "in": "10:33",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "04 Jun 2026",
    "in": "10:36",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "05 Jun 2026",
    "in": "10:27",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "06 Jun 2026",
    "in": "10:23",
    "out": "18:30"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "07 Jun 2026",
    "in": "10:16",
    "out": "18:01"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "08 Jun 2026",
    "in": "10:30",
    "out": "18:46"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "09 Jun 2026",
    "in": "10:25",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "10 Jun 2026",
    "in": "10:30",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "11 Jun 2026",
    "in": "10:25",
    "out": "18:36"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "12 Jun 2026",
    "in": "10:37",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "13 Jun 2026",
    "in": "12:34",
    "out": "18:30"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "14 Jun 2026",
    "in": "10:26",
    "out": "18:02"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "15 Jun 2026",
    "in": "10:27",
    "out": "18:35"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "16 Jun 2026",
    "in": "10:28",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "17 Jun 2026",
    "in": "10:48",
    "out": "18:41"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "18 Jun 2026",
    "in": "10:24",
    "out": "18:43"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "19 Jun 2026",
    "in": "10:32",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "20 Jun 2026",
    "in": "10:31",
    "out": "18:33"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "21 Jun 2026",
    "in": "10:27",
    "out": "18:10"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "22 Jun 2026",
    "in": "10:30",
    "out": "18:39"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "23 Jun 2026",
    "in": "10:33",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "24 Jun 2026",
    "in": "10:22",
    "out": "18:34"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "25 Jun 2026",
    "in": "10:44",
    "out": "18:50"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "26 Jun 2026",
    "in": "10:47",
    "out": "18:31"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "27 Jun 2026",
    "in": "10:34",
    "out": "18:32"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "28 Jun 2026",
    "in": "12:25",
    "out": "18:01"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "29 Jun 2026",
    "in": "10:28",
    "out": "18:35"
  },
  {
    "personId": "MB-CRM-0002",
    "date": "30 Jun 2026",
    "in": "10:26",
    "out": "18:31"
  }
] as const;

/**
 * On the machine, not matched to anybody. Held back rather than guessed — one of
 * these is present on 28 of 30 days, so somebody is working and not being paid
 * against a record.
 */
export const ATTENDANCE_HELD = [
  {
    "code": "3",
    "machineName": "Vishal Sharma",
    "candidates": [],
    "why": "nobody on the roster by that name"
  },
  {
    "code": "47",
    "machineName": "Manjari Bhardwaj",
    "candidates": [],
    "why": "nobody on the roster by that name"
  },
  {
    "code": "50",
    "machineName": "Kiran Sharma",
    "candidates": [
      "Kiran Bala"
    ],
    "why": "more than one possible person, or the surnames disagree"
  },
  {
    "code": "51",
    "machineName": "Priyanka Vee",
    "candidates": [
      "Priyanka Vig",
      "Priyanka Jalpaik"
    ],
    "why": "more than one possible person, or the surnames disagree"
  }
] as const;
