import React, {useEffect, useState} from 'react';

export function SpotMark(){return <img className="spot-mark spot-cartoon" src="/brand/spot-cartoon.png" alt="" aria-hidden="true"/>;}

export default function Brand({onHome}){
  return <a className="brand" href="#" onClick={e=>{e.preventDefault();onHome();}} aria-label="SPOTlight home">
    <SpotMark/><span className="brand-type"><span className="brand-word">SPOT<span>light</span></span><span className="brand-caption">INSPECTION, ILLUMINATED.</span></span>
  </a>;
}

export function ThemePicker(){
  const [theme,setTheme]=useState(()=>{try{const saved=localStorage.getItem('spotlight-theme');return ['forest','oat','ember'].includes(saved)?saved:'forest';}catch{return 'forest';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('spotlight-theme',theme);}catch{}},[theme]);
  return <label className="theme-picker"><span>PALETTE</span><select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="forest">Forest / lime</option><option value="oat">Oat / orange</option><option value="ember">Slate / amber</option></select></label>;
}
