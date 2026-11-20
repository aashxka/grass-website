const clamp=t=>Math.max(0,Math.min(1,t));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);

export const fetchControls={
  Dog:{
    'Size':[.9,.55,1.7,.05], 'Left end (%)':[17,5,45,1], 'Right end (%)':[88,55,95,1],
    'Ridge depth (m)':[0,-1.5,1.5,.05], 'Paw height (m)':[.24,0,.55,.01],
    'Coat warmth':[.2,0,1,.01], 'Coat hue (°)':[0,-40,40,1],
    'Saturation':[.87,.35,1.5,.01], 'Exposure':[1.03,.55,1.6,.01], 'Grass pressure':[1.2,0,2,.05],
    'Run speed (×)':[1.15,.4,2.5,.05], 'Gallop tempo (×)':[.95,.5,2,.05],
    'Sit before rising (s)':[.1,.1,3,.1], 'Balance hold (s)':[1.4,.1,3,.05]
  },
  Ball:{
    'Size':[.7,.55,2,.05], 'Beside dog (m)':[.4,.3,1.4,.02],
    'Rest height (m)':[.23,.05,.65,.01], 'Arc height (px)':[220,30,350,5],
    'Flight time (s)':[1.15,.45,2.5,.05], 'Bounce height (px)':[13,0,85,1],
    'Glow opacity':[.14,0,1,.01], 'Pulse rate (Hz)':[.48,0,3,.01],
    'Layer blur (px)':[3,0,14,.25], 'Glow rate (Hz)':[.35,0,3,.01]
  }
};
export function createFetch(stage,reduced,gl,program) {
  const settings=Object.fromEntries(Object.entries(fetchControls).map(([name,group])=>[name,Object.fromEntries(Object.entries(group).map(([k,v])=>[k,v[0]]))]));
  const layer=document.createElement('canvas');
  layer.setAttribute('aria-hidden','true');layer.style.cssText='position:absolute;inset:0;width:100%;height:100%;opacity:1;pointer-events:none';

  const ballLayer=document.createElement('canvas');
  const ctx=layer.getContext('2d'), ink=ballLayer.getContext('2d');
  const sprites=[layer,ballLayer].map(source=>({source,texture:gl.createTexture(),rect:null}));
  const vao=gl.createVertexArray();
  const material=program(`#version 300 es
    precision highp float;
    uniform vec4 rect;uniform vec2 viewport;uniform mat4 pv;uniform float depth;
    out vec2 uv;
    void main(){uv=vec2(gl_VertexID%2,gl_VertexID/2);
      vec2 screen=(rect.xy+uv*rect.zw)/viewport;
      gl_Position=vec4((2.*screen-1.)*vec2(1.,-1.)*depth,-pv[2][2]*depth+pv[3][2],depth);}
  `,`#version 300 es
    precision highp float;uniform sampler2D sprite;uniform float depth;
    in vec2 uv;out vec4 color;
    void main(){vec4 texel=texture(sprite,uv);
      float threshold=fract(dot(floor(gl_FragCoord.xy),vec2(.75487767,.56984029)));
      if(texel.a<=(max(.008,threshold)))discard;
      color=vec4(texel.rgb,log(depth/4.)/log(60.));}
  `);
  function render(pv,w,h){
    gl.useProgram(material.p);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE7);
    const u=material.u;gl.uniform1i(u.sprite,7);gl.uniform2f(u.viewport,w,h);gl.uniformMatrix4fv(u.pv,false,pv);
    for(const item of sprites){
      if(!item.rect)continue;
      gl.bindTexture(gl.TEXTURE_2D,item.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,item.source);
      gl.uniform4fv(u.rect,item.rect);gl.uniform1f(u.depth,item.depth);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
  }
  function prepare(index,x,y,w,h,d,ratio){
    const item=sprites[index],c=item.source;
    const width=Math.ceil(w*ratio),height=Math.ceil(h*ratio);
    if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
    const g=index===0?ctx:ink;
    g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,width/ratio,height/ratio);
    item.rect=[x,y,w,h];item.depth=d;
  }
  const button=document.createElement('button');
  button.type='button';button.title='Throw ball';button.setAttribute('aria-label','Throw ball to the opposite end of the hill');
  button.style.cssText='position:absolute;z-index:3;width:44px;height:44px;border:0;border-radius:50%;padding:0;background:transparent;cursor:pointer;transform:translate(-50%,-50%)';
  stage.append(button);button.hidden=true;
  const poses=[0,1,2,3,5,7,18,19,20,21,22,23];
  const images=[];
  for(const i of poses){
    images[i]=new Image();
    images[i].src='fetch/dog-'+String(i).padStart(2,'0')+'.webp';
  }
  // Tint each loaded sprite once, preserving cream markings and dark facial detail.
  const coats=images.map(im=>{
    const coat=document.createElement('canvas');
    im.addEventListener('load',()=>{
      coat.width=im.width;coat.height=im.height;
      const paint=coat.getContext('2d');
      paint.drawImage(im,0,0);
      const pixels=paint.getImageData(0,0,coat.width,coat.height),rgb=pixels.data;
      for(let i=0;i<rgb.length;i+=4){
        const r=rgb[i],g=rgb[i+1],b=rgb[i+2];
        const fur=smooth(clamp((r-b-3)/27))*smooth(clamp((g-b+2)/11));
        rgb[i]=r*(1-.10*fur);
        rgb[i+1]=g*(1-.32*fur);
        rgb[i+2]=b*(1-.47*fur);
      }
      paint.putImageData(pixels,0,0);
      coat.dataset.ready='1';
    },{once:true});
    return coat;
  });
  let phase='opening',time=0,run=0,from=0,to=1,pos=0,first=true,release,previousBall;
  const ballContact=new Float32Array(3);
  const paws=new Float32Array(24); let lastStamp=-1;
  const enter=p=>{phase=p;time=0};
  function replay(){paws.fill(0);lastStamp=-1;first=true;from=0;to=1;pos=0;run=0;release=null;previousBall=null;enter('opening');button.hidden=true;}
  button.onclick=()=>{if(phase!=='wait')return;from=to;to=1-to;run=0;first=false;release=previousBall;enter('chase');button.hidden=true};
  function ball(x,y,r,angle){
    ink.save();ink.translate(x,y);ink.beginPath();ink.arc(0,0,r,0,Math.PI*2);ink.clip();
    const paint=ink.createRadialGradient(-r*.42,-r*.52,0,0,0,r*1.3);
    paint.addColorStop(0,'#96d8ff');paint.addColorStop(.45,'#2588fa');paint.addColorStop(1,'#164e9a');
    ink.fillStyle=paint;ink.fillRect(-r,-r,2*r,2*r);
    ink.rotate(angle);ink.lineWidth=r*.21;ink.strokeStyle='#296dca';ink.beginPath();
    ink.moveTo(-r,-r*.52);ink.bezierCurveTo(-r*.1,-r*.65,-r*.14,r*.46,-r*.43,r*1.1);
    ink.moveTo(r*.25,-r);ink.bezierCurveTo(r*.48,-r*.5,r*.28,r*.36,r,r*.48);ink.stroke();ink.restore();
  }
  function draw(dt,view,hand) {
    const D=settings.Dog,B=settings.Ball;
    const scale=view.scale,w=view.width,h=view.height;
    const pixelRatio=view.pixelRatio;
    if(!coats[7].dataset.ready || !coats[18].dataset.ready)return;
    time+=dt;
    const start=Math.max(200,view.left+w/scale*.07),end=Math.min(1870,view.left+w/scale*.93);
    const left=Math.max(start,Math.min(end-100,20*D['Left end (%)']));
    const right=Math.max(left+75,Math.min(end,20*D['Right end (%)']));
    const direction=to===1?1:-1;
    if(phase==='opening'&&time>=.69){release={...hand};enter('chase')}
    const runDuration=(right-left)/(520*D['Run speed (×)']);
    const catchAt=.75, takeoff=.52;
    const interceptTime=B['Flight time (s)'];
    const duration=Math.max(runDuration,interceptTime/catchAt);
    const flightStart=duration*catchAt-interceptTime;
    if(phase==='chase'){
      run=clamp(time/duration);
      pos=mix(from,to,smooth(run));
      if(run>=1)enter('retrieve');
    }
    const dog=view.ridge(mix(left,right,pos),D['Ridge depth (m)'],D['Paw height (m)']);
    const jump=phase==='chase'?clamp((run-takeoff)/(1-takeoff)):0;
    const lift=4*jump*(1-jump)*B['Arc height (px)']*.53*scale;
    const atEnd=view.ridge(mix(left,right,to),D['Ridge depth (m)'],B['Rest height (m)']);
    const factor=dog.ppm*D.Size*.00385;
    let pose=20;
    if(phase==='opening')pose=7;
    if(phase==='chase')pose=run===0?5:jump>0?18:Math.floor(time*11*D['Gallop tempo (×)'])%4;
    if(phase==='retrieve'){
      pose=time<1.45?18:19;
      if(time>=1.84)enter('sit');
    }
    if(phase==='sit'&&time>D['Sit before rising (s)'])enter('rise');
    if(phase==='rise'){pose=21;if(time>.28)enter('balance')}
    if(phase==='balance'){pose=22;if(time>D['Balance hold (s)'])enter('lower')}
    if(phase==='lower'){pose=23;if(time>.34)enter('wait')}
    if(phase==='wait'&&!reduced){
      const beat=Math.floor(time/3),within=time%3;
      if(beat%2===1)pose=within<.22?21:22;
      else if(beat>0&&within<.22)pose=23;
    }
    if(reduced && first && phase==='opening'){pos=to;enter('wait')}
    for(let i=3;i<paws.length;i+=4)paws[i]*=Math.exp(-dt*4.8);
    const stamp=phase==='chase'?Math.floor(time*11*D['Gallop tempo (×)']):-1;
    if(!lift && stamp!==lastStamp && (pose===0||pose===2)){
      paws.copyWithin(4,0,20);
      paws.set([dog.worldX+direction*(pose===2?.22:-.21)*D.Size,dog.d,direction,D['Grass pressure']*D.Size]);
    }
    lastStamp=stamp;
    if(phase!=='chase'){
      paws.set([dog.worldX,dog.d,direction,.32*D['Grass pressure']*D.Size]);
    }
    const im=coats[pose].dataset.ready?coats[pose]:coats[7],dw=im.width*factor,dh=im.height*factor;
    prepare(0,dog.x-dw/2-5,dog.y-dh-3-lift,dw+10,dh+8+lift,dog.d,pixelRatio);
    ctx.save();ctx.translate(dw/2+5,dh+3);ctx.scale(direction,1);
    ctx.fillStyle='rgba(53,57,26,.18)';ctx.beginPath();ctx.ellipse(direction*5,lift,dw*.27,Math.max(1,factor*7),.05,0,2*Math.PI);ctx.fill();
    ctx.filter='brightness('+((.81+.19*dog.light)*D.Exposure)+') sepia('+D['Coat warmth']+') hue-rotate('+D['Coat hue (°)']+'deg) saturate('+D.Saturation+')';
    ctx.drawImage(im,-dw*.50,-dh,dw,dh);ctx.restore();
    let radius=atEnd.ppm*.105*B.Size;
    const rest={x:atEnd.x+direction*atEnd.ppm*B['Beside dog (m)'],y:atEnd.y-radius};
    let point=rest,angle=0;
    if(phase==='opening')point=hand;
    // Use the same raised muzzle at the flight endpoint and through the hold.
    const catchFrame=images[18],catchScale=atEnd.ppm*D.Size*.00385;
    const muzzle={
      x:atEnd.x+direction*.472*catchFrame.width*catchScale,
      y:atEnd.y-(D['Paw height (m)']-B['Rest height (m)'])*atEnd.ppm
        -.833*catchFrame.height*catchScale+radius*.5
    };
    if(phase==='chase'){
      const t=clamp((time-flightStart)/interceptTime),src=release||hand;
      const catchPos=mix(from,to,smooth(catchAt));
      const hit=view.ridge(mix(left,right,catchPos),D['Ridge depth (m)'],D['Paw height (m)']);
      const mouth=(ground,elevation)=>({
        x:ground.x+direction*.472*catchFrame.width*ground.ppm*D.Size*.00385,
        y:ground.y-.833*catchFrame.height*ground.ppm*D.Size*.00385+radius*.5-elevation
      });
      const j=(catchAt-takeoff)/(1-takeoff);
      const target=mouth(hit,4*j*(1-j)*B['Arc height (px)']*.53*scale);
      if(first)radius*=1/mix(atEnd.ppm/hand.ppm,1,t);
      point=run>=catchAt?mouth(dog,lift):{x:mix(src.x,target.x,t),y:mix(src.y,target.y,t)-4*t*(1-t)*B['Arc height (px)']*scale};
      angle=direction*t*8;
    }
    if(phase==='retrieve'){
      const drop=clamp((time-.72)/.35),bounce=clamp((time-1.07)/.30);
      point={x:mix(muzzle.x,rest.x,drop),y:mix(muzzle.y,rest.y,drop*drop)
        -4*bounce*(1-bounce)*Math.min(B['Bounce height (px)']*scale,(rest.y-muzzle.y)*.18)};
    }
    if(phase==='opening')radius=hand.ppm*.105*B.Size;
    ballContact[0]=atEnd.worldX+(point.x-atEnd.x)/atEnd.ppm;
    ballContact[1]=atEnd.d;
    ballContact[2]=phase==='opening'?0:clamp(1-Math.abs(rest.y-point.y)/(atEnd.ppm*.25));
    const pulse=phase==='wait'?(reduced?.5:.5-.5*Math.cos(time*2*Math.PI*B['Pulse rate (Hz)'])):0;
    radius*=1+.075*pulse;
    const spread=radius*1.4+B['Layer blur (px)'];
    const pad=Math.ceil(spread+2);
    const ballDepth=atEnd.d*(atEnd.ppm*.105*B.Size)/(radius/(1+.075*pulse));
    prepare(1,point.x-pad,point.y-pad,2*pad,2*pad,ballDepth-.015,pixelRatio);
    if(phase==='wait'){
      const halo=ink.createRadialGradient(pad,pad,radius*.8,pad,pad,spread);
      halo.addColorStop(0,'rgba(79,171,255,'+(B['Glow opacity']*(.75+.25*Math.cos((reduced?0:time)*2*Math.PI*B['Glow rate (Hz)'])))+')');halo.addColorStop(1,'rgba(79,171,255,0)');
      ink.fillStyle=halo;ink.fillRect(0,0,pad*2,pad*2);
    }
    ink.save();ink.filter='brightness('+(.87+.13*atEnd.light)+')';
    if(phase!=='opening'||time>=.44)ball(pad,pad,radius,angle);
    ink.restore();previousBall=point;
    button.hidden=phase!=='wait';button.style.left=point.x+'px';button.style.top=point.y+'px';
  }
  return {settings,paws,ballContact,draw,render,replay,get opening(){return phase==='opening'},get throwing(){return !reduced&&(phase==='opening'||(first&&phase==='chase'&&time<.32))},get throwPose(){return phase==='chase'?10:time<.44?8:9}};
}
