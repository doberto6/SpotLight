const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const legLengths={upper:.205,lower:.215};
export function legIK(x,y) {
  const {upper:a,lower:b}=legLengths,d=clamp(Math.hypot(x,y),Math.abs(a-b)+.0001,a+b-.0001);
  const hip=Math.atan2(x,-y)-Math.acos(clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
  const knee=Math.PI-Math.acos(clamp((a*a+b*b-d*d)/(2*a*b),-1,1));
  return {hip,knee};
}
export function footTarget(phase,stride=1,direction=1) {
  const t=((phase/(Math.PI*2))%1+1)%1;
  const swing=t>=.62,u=swing?(t-.62)/.38:t/.62;
  const x=(swing?-.095+.19*(u*u*(3-2*u)):.095-.19*u)*stride*direction;
  return {x:x+.015,y:-.374+(swing?Math.sin(Math.PI*u)*.075*stride:0)};
}
