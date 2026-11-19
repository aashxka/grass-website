// A screen-space field of damped springs. Each blade samples its own patch.
export function grassBrush(canvas, gl) {
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE4);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const key of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, key, gl.LINEAR);
  for (const key of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
    gl.texParameteri(gl.TEXTURE_2D, key, gl.CLAMP_TO_EDGE);
  let cols=0, rows=0, offsets, velocities, pixels;
  let x=0, y=0, lastX=0, lastY=0, active=false, settling=0;
  let holdSeconds = 0;
  function contact(e) {
    if (!e.isPrimary) return;
    const rect=canvas.getBoundingClientRect();
    const nextX=e.clientX-rect.left, nextY=rect.bottom-e.clientY;
    if (active && nextX===x && nextY===y && e.type!=='pointerdown') return;
    holdSeconds=.075;
    x=nextX; y=nextY;
    if (!active) { lastX=x; lastY=y; }
    active=true;
  }
  function release() { active=false; }
  canvas.style.touchAction='none';
  canvas.addEventListener('pointermove', contact);
  canvas.addEventListener('pointerdown', contact);
  canvas.addEventListener('pointerleave', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerup', e => { if(e.pointerType !== 'mouse') release(); });
  window.addEventListener('blur', release);

  return function update(dt, radius) {
    const w=canvas.clientWidth, h=canvas.clientHeight;
    const nx=Math.max(2,Math.ceil(w/12)), ny=Math.max(2,Math.ceil(h/12));
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D,texture);
    if (nx!==cols || ny!==rows) {
      cols=nx; rows=ny;
      offsets=new Float32Array(nx*ny*2); velocities=new Float32Array(offsets.length);
      pixels=new Uint8Array(offsets.length).fill(128);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RG8,nx,ny,0,gl.RG,gl.UNSIGNED_BYTE,null);
      settling=1;
    }
    const pressing = active && holdSeconds>0;
    holdSeconds=Math.max(0,holdSeconds-dt);
    if (!pressing && settling<=0) return;
    if (pressing) settling=1; else settling-=dt;
    const dx=x-lastX, dy=y-lastY, length2=dx*dx+dy*dy;
    const steps=Math.max(1,Math.ceil(dt*120)), step=dt/steps;
    for (let row=0;row<rows;row++) for (let col=0;col<cols;col++) {
      const px=(col+.5)*w/cols, py=(row+.5)*h/rows;
      const along=length2 ? Math.min(1,Math.max(0,((px-lastX)*dx+(py-lastY)*dy)/length2)) : 1;
      const rx=px-lastX-along*dx, ry=py-lastY-along*dy;
      const dist=Math.hypot(rx,ry);
      const t=pressing ? Math.max(0,1-dist/radius) : 0;
      const force=t*t*(3-2*t), reach=Math.max(6,dist);
      const tx=force*(rx/reach+.55*Math.tanh(dx/12));
      const ty=force*(ry/reach+.55*Math.tanh(dy/12));
      const i=2*(row*cols+col);
      for (let axis=0;axis<2;axis++) {
        const k=i+axis, target=axis===0?tx:ty;
        for (let n=0;n<steps;n++) {
          velocities[k]+=(320*(target-offsets[k])-30*velocities[k])*step;
          offsets[k]+=velocities[k]*step;
        }
        pixels[k]=128+Math.round(100*Math.max(-1.27,Math.min(1.27,offsets[k])));
      }
    }
    lastX=x; lastY=y;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,cols,rows,gl.RG,gl.UNSIGNED_BYTE,pixels);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  };
}
