const throwFrames = [
  { time: 0, pose: 8, handX: .272, handY: .460 },
  { time: .57, pose: 8, handX: .272, handY: .460 },
  { time: .81, pose: 9, handX: .807, handY: .350 },
  { time: 1.02, pose: 10, handX: .838, handY: .107 },
  { time: 1.20, pose: 10, handX: .838, handY: .107 },
  { time: 1.38, pose: 9, handX: .807, handY: .350 },
  { time: 1.60, pose: 4, handX: .509, handY: .546 },
];
export const throwTiming = {
  openingDelay: 1.5,
  release: throwFrames[3].time,
  end: throwFrames.at(-1).time,
};
export const FIGURE_HEIGHT = 1.78 * 256 / 246;

export function sampleThrow(time) {
  let i = 0;
  while (i < throwFrames.length - 2 && time > throwFrames[i + 1].time) i++;
  const a = throwFrames[i], b = throwFrames[i + 1];
  const t = Math.min(1, Math.max(0, (time - a.time) / (b.time - a.time)));
  const blend = t * t * (3 - 2 * t);
  return {
    direction: 1, pose: a.pose, next: b.pose, blend, flash: 0,
    handX: a.handX + (b.handX - a.handX) * blend,
    handY: a.handY + (b.handY - a.handY) * blend,
  };
}

export function createPhotographer(reduced) {
  const interval = 5;
  const shutter = 0.89;
  const photoTimes = [0, 0.16, 0.38, 0.66, 1.05, 1.29, 1.56];
  const photoPoses = [4, 4, 5, 6, 6, 5, 4];
  const clipDuration = photoTimes[photoTimes.length - 1];
  const state = { direction: 1, pose: 4, next: 4, blend: 0, flash: 0 };
  let clock = 0;
  let startedAt = -Infinity;
  // Start raising the camera early so the first shutter fires at five seconds.
  let nextPhotoAt = interval - shutter;

  function photo() {
    const age = clock - startedAt;
    if (age >= 0.66 && age < 1.05) startedAt = clock - shutter;
    else if (age >= 1.05) startedAt = clock;
    nextPhotoAt = startedAt + interval;
  }

  function tick(dt, pause = 1.2) {
    clock += dt;
    const scheduled = Math.max(nextPhotoAt, startedAt + clipDuration + pause);
    if (clock >= scheduled) {
      startedAt = clock - scheduled < clipDuration ? scheduled : clock;
      nextPhotoAt = startedAt + interval;
    }

    const age = clock - startedAt;
    if (age >= clipDuration) {
      Object.assign(state, { pose: 4, next: 4, blend: 0, flash: 0 });
      return state;
    }

    let segment = 0;
    while (age > photoTimes[segment + 1]) segment++;
    const amount = (age - photoTimes[segment]) / (photoTimes[segment + 1] - photoTimes[segment]);
    Object.assign(state, {
      pose: photoPoses[segment],
      next: photoPoses[segment + 1],
      blend: amount * amount * (3 - 2 * amount),
      flash: reduced ? 0 : Math.max(0, 1 - Math.abs(age - shutter) / 0.095),
    });
    return state;
  }

  return { tick, photo, state };
}

export function createFigure(gl,program) {
  const shader=program(`#version 300 es
    precision highp float; uniform mat4 pv;uniform vec3 feet;uniform float facing, size;
    out vec2 uv;void main(){
      uv=vec2(gl_VertexID%2,gl_VertexID/2);
      vec2 pt=vec2((uv.x-.5)*facing,(1.-uv.y))*size*${FIGURE_HEIGHT};
      gl_Position=pv*vec4(feet+vec3(pt,0.),1.);
    }`,`#version 300 es
    precision highp float;in vec2 uv;out vec4 color;
    uniform sampler2D atlas;uniform vec4 frames;uniform vec3 lighting;uniform float facing,flash,depth;
    vec4 samplePose(float frame) {
      vec4 pixel=texture(atlas, (vec2(mod(frame, 4.), floor(frame / 4.)) + uv) / 4., -.45);
      // The wind-up artwork has its own painted ball. Render the animated ball in its place.
      if (frame == 8. && distance(uv, vec2(.272,.460)) < .040 && pixel.b > pixel.r * 1.1) pixel.a = 0.;
      return pixel;
    }

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
  function draw(s,pv,x,y,d,light,rim,size){
    if(!ready)return;
    const u=shader.u;gl.useProgram(shader.p);gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(u.atlas,7);
    gl.uniformMatrix4fv(u.pv,false,pv);gl.uniform3f(u.feet,x,y,-d);
    gl.uniform1f(u.size,size);gl.uniform1f(u.facing,s.direction);
    gl.uniform4f(u.frames,s.pose,s.next,s.blend,0);gl.uniform1f(u.flash,s.flash);
    gl.uniform3f(u.lighting,light,rim,0);gl.uniform1f(u.depth,Math.log(d/4)/Math.log(60));
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  return { draw, get ready() { return ready; } };
}
