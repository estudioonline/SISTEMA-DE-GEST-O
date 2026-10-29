export function inactivityMinutes(value:unknown){
  const minutes=Number(value)
  return Number.isFinite(minutes)&&minutes>=5&&minutes<=480?minutes:30
}
export function sessionExpired(lastActivity:number,now:number,minutes:unknown){
  return !Number.isFinite(lastActivity)||now-lastActivity>=inactivityMinutes(minutes)*60_000
}
