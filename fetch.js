const clamp=t=>Math.max(0,Math.min(1,t));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const scarfOrange='#c65a13';

export const fetchControls={
  Dog:{
    'Size':[1.05,.55,1.7,.05], 'Left end (%)':[21,5,45,1], 'Right end (%)':[88,55,95,1],
    'Ridge depth (m)':[-0.75,-1.5,1.5,.05], 'Paw height (m)':[0.21,0,.55,.01],
    'Coat warmth':[.2,0,1,.01], 'Coat hue (°)':[0,-40,40,1],
    'Saturation':[.87,.35,1.5,.01], 'Exposure':[1.03,.55,1.6,.01], 'Grass pressure':[1,0,2,.05],
    'Run speed (×)':[1.15,.4,2.5,.05], 'Gallop tempo (×)':[.95,.5,2,.05],
    'Sit before rising (s)':[.1,.1,3,.1], 'Balance hold (s)':[1.4,.1,3,.05]
  },
  Ball:{
    'Size':[.7,.55,2,.05], 'Beside dog (m)':[.4,.3,1.4,.02],
    'Rest height (m)':[0.23,.05,.65,.01], 'Arc height (px)':[220,30,350,5],
    'Flight time (s)':[1.15,.45,2.5,.05], 'Bounce height (px)':[13,0,85,1],
    'Ring gap (px)':[3.5,0,30,.5], 'Ring colour':{type:'color',default:'#fce3d7'},
    'Ring opacity':[.6,0,1,.01], 'Glow opacity':[0.25,0,1,.01], 'Pulse rate (Hz)':[1.04,0,3,.01],
    'Layer blur (px)':[5.5,0,14,.25], 'Glow rate (Hz)':[0.89,0,3,.01]
  }
};
export function createFetch(stage,reduced,gl,program,throwTiming) {
  const settings=Object.fromEntries(Object.entries(fetchControls).map(([name,group])=>[name,Object.fromEntries(Object.entries(group).map(([k,v])=>[k,Array.isArray(v)?v[0]:v.default]))]));
  const sprites=Array.from({length:3},()=>{
    const source=document.createElement('canvas');
    return {source,context:source.getContext('2d'),texture:gl.createTexture(),rect:null,alphaCutoff:.12};
  });
  const [dogSprite,ballSprite,ringSprite]=sprites;
  const {context:ctx}=dogSprite, {context:ink}=ballSprite, {context:ring}=ringSprite;
  ringSprite.alphaCutoff=0;
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
    uniform vec4 neck; uniform vec2 extent; uniform float pitch, alphaCutoff;
    uniform bool blendRing;
    in vec2 uv;out vec4 color;
    void main(){
      vec2 sampleUV=uv;
      if(pitch>0.){
        vec2 delta=(uv-neck.xy)*extent;
        float towardNose=delta.x*neck.z;
        float weight=smoothstep(-.07,.12,towardNose/neck.w)
          *(1.-smoothstep(.01,.19,delta.y/neck.w));
        float angle=pitch*neck.z*weight;
        vec2 src=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*delta;
        sampleUV=neck.xy+src/extent;
      }
      vec4 texel=texture(sprite,sampleUV);
      if(texel.a <= alphaCutoff) discard;
      color=vec4(texel.rgb,blendRing ? texel.a : log(depth/4.)/log(60.));}
  `);
  function renderSprites(pv,w,h,items,blendRing){
    gl.useProgram(material.p);gl.bindVertexArray(vao);gl.activeTexture(gl.TEXTURE7);
    const u=material.u;gl.uniform1i(u.sprite,7);gl.uniform2f(u.viewport,w,h);gl.uniformMatrix4fv(u.pv,false,pv);
    gl.uniform1i(u.blendRing,blendRing?1:0);
    for(const item of items){
      if(!item.rect)continue;
      gl.bindTexture(gl.TEXTURE_2D,item.texture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,item.source);
      gl.uniform1f(u.pitch,item.pitch||0);
      gl.uniform1f(u.alphaCutoff,item.alphaCutoff);
      if(item.pitch){gl.uniform4fv(u.neck,item.neck);gl.uniform2f(u.extent,item.rect[2],item.rect[3]);}
      gl.uniform4fv(u.rect,item.rect);gl.uniform1f(u.depth,item.depth);
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    }
  }
  function render(pv,w,h){
    renderSprites(pv,w,h,[dogSprite,ballSprite],false);
  }
  function renderRing(pv,w,h){
    if(!ringSprite.rect)return;
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    // Preserve the depth encoded in the scene alpha for the post-processing pass.
    gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
    renderSprites(pv,w,h,[ringSprite],true);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
  function prepare(item,x,y,w,h,d,ratio){
    const c=item.source;
    const width=Math.ceil(w*ratio),height=Math.ceil(h*ratio);
    if(c.width!==width||c.height!==height){c.width=width;c.height=height;}
    const g=item.context;
    g.setTransform(ratio,0,0,ratio,0,0);g.clearRect(0,0,width/ratio,height/ratio);
    item.rect=[x,y,w,h];item.depth=d;
  }
  const button=document.createElement('button');
  button.type='button';button.title='Throw ball';button.setAttribute('aria-label','Throw ball to the opposite end of the hill');
  button.style.cssText='position:absolute;z-index:3;width:44px;height:44px;border:0;border-radius:50%;padding:0;background:transparent;cursor:pointer;transform:translate(-50%,-50%)';
  stage.append(button);button.hidden=true;
  const poses=[0,1,2,3,5,7,11,12,15,18,19,20,21,22,23];
  const images=[];
  for(const i of poses){
    images[i]=new Image();
    images[i].src='fetch/hd/dog-'+String(i).padStart(2,'0')+'.webp';
  }
  // Logical frame sizes keep the original paw, muzzle and ball anchors in scene units.
  const poseSize=[[341,180],[368,151],[358,170],[323,160],[343,192],[305,222],[296,216],[231,220],[227,226],[197,228],[198,241],[175,264],[211,236],[236,214],[218,218],[350,201],[258,155],[279,154],[273,192],[218,198],[129,227],[127,228],[114,278],[113,248]];
  const loaded=i=>images[i]?.naturalWidth>0;
  let phase='opening',time=0,run=0,from=0,to=1,pos=0,first=true,release,previousBall;
  let throwAge=reduced?null:-throwTiming.openingDelay;
  const ballContact=new Float32Array(3);
  const paws=new Float32Array(24); let lastStamp=-1;
  const enter=p=>{phase=p;time=0};
  function replay(){paws.fill(0);lastStamp=-1;first=true;from=0;to=1;pos=0;run=0;release=null;previousBall=null;throwAge=reduced?null:0;enter('opening');button.hidden=true;}
  button.onclick=()=>{if(phase!=='wait')return;from=to;to=1-to;run=0;first=false;release=previousBall;enter('chase');button.hidden=true};
  function ball(x,y,r,angle){
    ink.save();ink.translate(x,y);ink.beginPath();ink.arc(0,0,r,0,Math.PI*2);ink.clip();
    const paint=ink.createRadialGradient(-r*.42,-r*.52,0,0,0,r*1.3);
    paint.addColorStop(0,'#f5b271');paint.addColorStop(.45,scarfOrange);paint.addColorStop(1,'#733209');
    ink.fillStyle=paint;ink.fillRect(-r,-r,2*r,2*r);
    ink.rotate(angle);ink.lineWidth=r*.21;ink.strokeStyle='#a34812';ink.beginPath();
    ink.moveTo(-r,-r*.52);ink.bezierCurveTo(-r*.1,-r*.65,-r*.14,r*.46,-r*.43,r*1.1);
    ink.moveTo(r*.25,-r);ink.bezierCurveTo(r*.48,-r*.5,r*.28,r*.36,r,r*.48);ink.stroke();ink.restore();
  }
  function draw(dt,view,handAt) {
    const D=settings.Dog,B=settings.Ball;
    const scale=view.scale,w=view.width,h=view.height;
    const pixelRatio=view.pixelRatio;
    if(![7,11,12,15,18].every(loaded))return;
    if(throwAge!==null){
      throwAge+=dt;
      if(throwAge>=throwTiming.end)throwAge=null;
    }
    time+=dt;
    const start=Math.max(200,view.left+w/scale*.07),end=Math.min(1870,view.left+w/scale*.93);
    const left=Math.max(start,Math.min(end-100,20*D['Left end (%)']));
    const right=Math.max(left+75,Math.min(end,20*D['Right end (%)']));
    const direction=to===1?1:-1;
    if(phase==='opening'&&reduced){
      pos=to;
      enter('wait');
    }else if(phase==='opening'&&throwAge>=throwTiming.release){
      release=handAt(throwTiming.release);
      enter('chase');
    }
    const runDuration=(right-left)/(520*D['Run speed (×)']);
    const duration=Math.max(B['Flight time (s)'],runDuration);
    const leapTime=Math.min(.64,duration*.43);
    const takeoff=1-leapTime/duration, catchAt=takeoff+.5*(1-takeoff);
    const interceptTime=duration*catchAt;
    if(phase==='chase'){
      run=clamp(time/duration);
      pos=mix(from,to,run);
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
    if(jump>0)pose=jump<.20?12:jump<.64?11:jump<.82?12:15;
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
    const frame=loaded(pose)?pose:7, im=images[frame];
    const dw=poseSize[frame][0]*factor,dh=poseSize[frame][1]*factor;
    const margin=Math.ceil(dw*.18+5);
    // The opening sit has a baked soft halo. Use its solid silhouette.
    dogSprite.alphaCutoff=frame===7?.60:.12;
    prepare(dogSprite,dog.x-dw/2-margin,dog.y-dh-margin-lift,dw+2*margin,dh+2*margin+lift,dog.d,pixelRatio);
    ctx.save();ctx.translate(dw/2+margin,dh+margin);ctx.scale(direction,1);
    ctx.fillStyle='rgba(53,57,26,.18)';ctx.beginPath();ctx.ellipse(direction*5,lift,dw*.27,Math.max(1,factor*7),.05,0,2*Math.PI);ctx.fill();
    ctx.filter='brightness('+((.81+.19*dog.light)*D.Exposure)+') sepia('+D['Coat warmth']+') hue-rotate('+D['Coat hue (°)']+'deg) saturate('+D.Saturation+')';
    ctx.drawImage(im,-dw*.50,-dh,dw,dh);ctx.restore();
    let radius=atEnd.ppm*.105*B.Size;
    const rest={x:atEnd.x+direction*atEnd.ppm*B['Beside dog (m)'],y:atEnd.y-radius};
    let point=rest,angle=0;
    if(phase==='opening')point=handAt(Math.max(0,throwAge));
    // Use the same raised muzzle at the flight endpoint and through the hold.
    const catchFrame=poseSize[18],catchScale=atEnd.ppm*D.Size*.00385;
    const muzzle={
      x:atEnd.x+direction*.472*catchFrame[0]*catchScale,
      y:atEnd.y-(D['Paw height (m)']-B['Rest height (m)'])*atEnd.ppm
        -.833*catchFrame[1]*catchScale+radius*.5
    };
    if(phase==='chase'){
      const t=clamp(time/interceptTime),src=release;
      const catchPos=mix(from,to,catchAt);
      const hit=view.ridge(mix(left,right,catchPos),D['Ridge depth (m)'],D['Paw height (m)']);
      const mouth=(ground,elevation,frame)=>{
        const [mx,my]=frame===11?[.32,.91]:frame===12?[.42,.86]:[.47,.86];
        const f=ground.ppm*D.Size*.00385;
        return {
        x:ground.x+direction*mx*poseSize[frame][0]*f,
        y:ground.y-my*poseSize[frame][1]*f+radius*.5-elevation};
      };
      const j=(catchAt-takeoff)/(1-takeoff);
      const target=mouth(hit,4*j*(1-j)*B['Arc height (px)']*.53*scale,11);
      if(first)radius*=1/mix(atEnd.ppm/src.ppm,1,t);
      point=run>=catchAt?mouth(dog,lift,pose):{x:mix(src.x,target.x,t),y:mix(src.y,target.y,t)-4*t*(1-t)*B['Arc height (px)']*scale};
      angle=direction*t*8;
    }
    const body=sprites[0];
    body.pitch=0;
    if(phase==='chase' && jump===0 && frame<4){
      const neckX=dog.x+direction*.20*dw, neckY=dog.y-.70*dh;
      const elevation=Math.atan2(neckY-point.y,Math.max(dw*.25,Math.abs(point.x-neckX)));
      const settle=smooth(clamp((takeoff-run)*duration/.12));
      body.pitch=Math.max(0,Math.min(.52,elevation))*settle*smooth(clamp(time/.09));
      body.neck=[(neckX-body.rect[0])/body.rect[2],(neckY-body.rect[1])/body.rect[3],direction,dw];
    }
    if(phase==='retrieve'){
      const drop=clamp((time-.72)/.35),bounce=clamp((time-1.07)/.30);
      point={x:mix(muzzle.x,rest.x,drop),y:mix(muzzle.y,rest.y,drop*drop)
        -4*bounce*(1-bounce)*Math.min(B['Bounce height (px)']*scale,(rest.y-muzzle.y)*.18)};
    }
    if(phase==='opening')radius=point.ppm*.105*B.Size;
    ballContact[0]=atEnd.worldX+(point.x-atEnd.x)/atEnd.ppm;
    ballContact[1]=atEnd.d;
    ballContact[2]=phase==='opening'?0:clamp(1-Math.abs(rest.y-point.y)/(atEnd.ppm*.25));
    const pulse=phase==='wait'?(reduced?.5:.5-.5*Math.cos(time*2*Math.PI*B['Pulse rate (Hz)'])):0;
    radius*=1+.075*pulse;
    const ringWidth=Math.max(1.3,radius*.23);
    const ringRadius=radius+B['Ring gap (px)']+ringWidth/2;
    const spread=ringRadius+ringWidth+B['Layer blur (px)']*2;
    const pad=Math.ceil(spread+2);
    const ballDepth=atEnd.d*(atEnd.ppm*.105*B.Size)/(radius/(1+.075*pulse));
    prepare(ballSprite,point.x-pad,point.y-pad,2*pad,2*pad,ballDepth-.015,pixelRatio);
    ringSprite.rect=null;
    if(phase==='wait'&&B['Ring opacity']>0){
      prepare(ringSprite,point.x-pad,point.y-pad,2*pad,2*pad,ballDepth-.015,pixelRatio);
      ring.save();
      ring.strokeStyle=B['Ring colour'];
      ring.shadowColor=`color-mix(in srgb, ${B['Ring colour']} ${B['Glow opacity']*100}%, transparent)`;
      ring.globalAlpha=B['Ring opacity']*(.8+.2*Math.cos((reduced?0:time)*2*Math.PI*B['Glow rate (Hz)']));
      ring.shadowBlur=B['Layer blur (px)']*pixelRatio;
      ring.lineWidth=ringWidth;
      for(let quadrant=0;quadrant<4;quadrant++){
        const start=quadrant*Math.PI/2;
        ring.beginPath();ring.arc(pad,pad,ringRadius,start+.12,start+Math.PI/2-.12);ring.stroke();
      }
      ring.restore();
    }
    ink.save();ink.filter='brightness('+(.87+.13*atEnd.light)+')';
    if(phase!=='opening'||throwAge>=0)ball(pad,pad,radius,angle);
    ink.restore();previousBall=point;
    button.hidden=phase!=='wait';button.style.left=point.x+'px';button.style.top=point.y+'px';
  }
  return {settings,paws,ballContact,draw,render,renderRing,replay,get throwAge(){return throwAge<0?null:throwAge}};
}
