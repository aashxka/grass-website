// Distances use reference-banner pixels. One landing advances one stride length.
export function createWalker(reduced) {
  const left = -18, right = 18, stride = (right-left)/2, cadence = .57;
  let phase = 'approach', elapsed = 0, direction = 1, start = left, x = left, leading = 0;
  const state = { x, direction, pose: 4, next: 4, blend: 0, bob: 0, flash: 0, phase };
  function enter(name) { phase = name; elapsed = 0; start = x; }
  let completedLegs=0, resume=null;
  function photo() {
    if(phase!=='photo'){resume={phase,elapsed,start};enter('photo');}
    else elapsed=0;
  }
  function tick(dt,speed=1,pause=.22) {
    if (reduced && phase !== 'photo') return state;
    elapsed += dt * ((phase === 'approach' || phase === 'travel') ? speed : 1);
    let pose = 4, next = 4, blend = 0, bob = 0, flash = 0;
    if (phase === 'approach' || phase === 'travel') {
      const end = Math.max(left,Math.min(right,start + direction * stride * 2));
      const steps = Math.abs(end-start)/stride;
      const progress = Math.min(steps, elapsed/cadence);
      x = start + direction * stride * progress;
      const frame = leading + progress * 2;
      pose = Math.floor(frame) % 4; next = (pose+1)%4; blend=Math.max(0,(frame%1-.78)/.22);
      bob = .012 * Math.sin(Math.PI*progress)**2;
      if (progress >= steps) { x=end; leading=(leading+4)%4; enter('photo'); }
    } else if (phase === 'photo') {
      const times=[0,.16,.38,.66,1.05,1.29,1.56,1.78], poses=[4,4,5,6,6,5,4,4];
      let i=0; while(i<times.length-2 && elapsed>times[i+1]) i++;
      pose=poses[i]; next=poses[i+1]; blend=Math.min(1,(elapsed-times[i])/(times[i+1]-times[i]));
      flash=reduced ? 0 : Math.max(0,1-Math.abs(elapsed-.89)/.095);
      if(elapsed>=1.56+pause){
        if(resume){({phase,elapsed,start}=resume); resume=null;}
        else enter(++completedLegs===2?'idle':'turn');
      }
    } else if(phase==='turn') {
      pose=elapsed<.12 ? 4 : 7; next=pose;
      if(elapsed>=.5){direction *= -1; enter('approach');}
    }
    Object.assign(state,{x,direction,pose,next,blend:blend*blend*(3-2*blend),bob,flash,phase});
    return state;
  }
  return {tick,photo,state};
}
export function createFigure(gl,program) {
  const shader=program(`#version 300 es
    precision highp float; uniform mat4 pv;uniform vec3 feet;uniform float bob, facing, size;
    out vec2 uv;void main(){
      uv=vec2(gl_VertexID%2,gl_VertexID/2);
      vec2 pt=vec2((uv.x-.5)*facing,(1.-uv.y))*(size*1.78*256./246.);
      gl_Position=pv*vec4(feet+vec3(pt.x,pt.y+bob,0.),1.);
    }`,`#version 300 es
    precision highp float;in vec2 uv;out vec4 color;
    uniform sampler2D atlas;uniform vec4 frames;uniform vec3 lighting;uniform float facing,flash,depth;
    vec4 samplePose(float k){return texture(atlas,(vec2(mod(k,4.),floor(k/4.))+uv)/vec2(4.,4.),-.45);}
    void main(){
      vec4 a=samplePose(frames.x),b=samplePose(frames.y);float alpha=mix(a.a,b.a,frames.z);
      vec3 rgb=mix(a.rgb*a.a,b.rgb*b.a,frames.z)/max(.001,alpha);
      vec2 delta=uv-vec2(.68,.135);
      float spark=flash*2.6*max(exp(-length(delta)*43.),max(exp(-abs(delta.x)*380.-abs(delta.y)*30.),exp(-abs(delta.y)*380.-abs(delta.x)*30.)));
      if(max(alpha,spark)<.26)discard;
      float rim=smoothstep(-.1,.35,(.5-uv.x)*facing)*lighting.y;
      rgb*=mix(vec3(.69,.76,.79),vec3(1.02,.98,.89),lighting.x);
      rgb+=vec3(.07,.045,.018)*rim;
      color=vec4(mix(rgb,mix(vec3(1.,.85,.28),vec3(1.,1.,.91),smoothstep(.55,1.5,spark)),min(1.,spark*2.)),depth);
    }`);
  const tex=gl.createTexture(), vao=gl.createVertexArray(), img=new Image();
  let ready=false;
  img.onload=()=>{gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
    gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);ready=true;};
  img.src='./fetch/hd/figure.webp';
  return (s,pv,x,y,d,light,rim,size)=>{
    if(!ready)return;
    const u=shader.u;gl.useProgram(shader.p);gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(u.atlas,7);
    gl.uniformMatrix4fv(u.pv,false,pv);gl.uniform3f(u.feet,x,y,-d);
    gl.uniform1f(u.size,size);gl.uniform1f(u.bob,s.bob);gl.uniform1f(u.facing,s.direction);
    gl.uniform4f(u.frames,s.pose,s.next,s.blend,0);gl.uniform1f(u.flash,s.flash);
    gl.uniform3f(u.lighting,light,rim,0);gl.uniform1f(u.depth,Math.log(d/4)/Math.log(60));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  };
}
