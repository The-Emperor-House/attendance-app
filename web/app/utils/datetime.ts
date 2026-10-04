// All times in the app are Bangkok wall-clock time in 24-hour format ("08:30", "17:45"),
// whatever the viewer's browser locale is, so nobody has to guess between AM and PM.

const TIME_ZONE = 'Asia/Bangkok'

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE })

// ISO timestamp -> "HH:mm" (24-hour, Bangkok).
export function formatTime(iso: string | Date) {
  return timeFormat.format(new Date(iso))
}

// ISO timestamp -> "YYYY-MM-DD" (Bangkok calendar day).
export function bangkokDate(iso: string | Date) {
  return dateFormat.format(new Date(iso))
}

// "04 ต.ค. 08:30" — for timestamps that may fall on a different day than their row.
export function formatDateTime(iso: string | Date) {
  const day = new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', timeZone: TIME_ZONE })
  return `${day} ${formatTime(iso)}`
}

// "YYYY-MM-DD" + "HH:mm" (Bangkok) -> ISO timestamp.
export function bangkokToISO(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`).toISOString()
}
