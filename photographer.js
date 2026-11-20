// Distances use reference-banner pixels.
export function createWalker(reduced) {
  const stepLength = 18;
  const secondsPerStep = .72;
  const photoTimes = [0, .16, .38, .66, 1.05, 1.29, 1.56, 1.78];
  const photoPoses = [4, 4, 5, 6, 6, 5, 4, 4];
  let route = 0;
  let gait = 1;
  let photoTime = null;
  const state = { x: 0, direction: 1, pose: 4, next: 4, blend: 0, bob: 0, flash: 0, phase: 'travel' };

  function photo() {
    photoTime = 0;
  }

  function tick(dt, speed = 1, pause = .22, walkDistance = 144) {
    if (photoTime !== null) {
      photoTime += dt;
      let segment = 0;
      while (segment < photoTimes.length - 2 && photoTime > photoTimes[segment + 1]) segment++;
      const fraction = Math.min(1, (photoTime - photoTimes[segment]) / (photoTimes[segment + 1] - photoTimes[segment]));
      Object.assign(state, {
        pose: photoPoses[segment],
        next: photoPoses[segment + 1],
        blend: fraction * fraction * (3 - 2 * fraction),
        flash: reduced ? 0 : Math.max(0, 1 - Math.abs(photoTime - .89) / .095),
        phase: 'photo',
      });
      if (photoTime < 1.56 + pause) return state;
      photoTime = null;
      dt = 0;
    }

    state.phase = 'travel';
    state.flash = 0;
    if (reduced) return Object.assign(state, { pose: 4, next: 4, blend: 0 });

    const steps = dt * speed / secondsPerStep;
    const distance = Math.max(1, walkDistance);
    route = (route + steps * stepLength / distance) % 2;
    const direction = route < 1 ? 1 : -1;
    const legProgress = direction === 1 ? route : 2 - route;

    // Ease through the change of direction, then maintain a steady pace across the ridge.
    const turnaround = .11;
    const edge = Math.min(legProgress, 1 - legProgress);
    const easedEdge = edge < turnaround ? edge * edge / (2 * turnaround) : edge - turnaround / 2;
    const travel = legProgress <= .5 ? easedEdge / (1 - turnaround) : 1 - easedEdge / (1 - turnaround);

    gait = (gait + steps * 2) % 4;
    const pose = Math.floor(gait);
    Object.assign(state, {
      x: (travel - .5) * walkDistance,
      direction,
      pose,
      next: (pose + 1) % 4,
      blend: gait - pose,
    });
    return state;
  }

  return { tick, photo, state };
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
    vec4 samplePose(float k, vec2 point) {
      if (any(lessThan(point, vec2(0.))) || any(greaterThan(point, vec2(1.)))) return vec4(0.);
      return texture(atlas, (vec2(mod(k,4.), floor(k/4.)) + point) / 4., -.45);
    }

    // Each pair describes the near and far legs of one walk pose, measured on the atlas.
    const vec2 hip[8] = vec2[8](
      vec2(.50,.47), vec2(.49,.47), vec2(.50,.47), vec2(.49,.47),
      vec2(.50,.47), vec2(.51,.47), vec2(.50,.47), vec2(.50,.47));
    const vec2 knee[8] = vec2[8](
      vec2(.62,.69), vec2(.34,.69), vec2(.59,.68), vec2(.46,.72),
      vec2(.36,.69), vec2(.62,.69), vec2(.58,.65), vec2(.49,.71));
    const vec2 ankle[8] = vec2[8](
      vec2(.74,.92), vec2(.26,.92), vec2(.56,.93), vec2(.31,.88),
      vec2(.25,.91), vec2(.75,.91), vec2(.53,.91), vec2(.45,.91));

    vec3 mapSegment(vec2 p, vec2 fromA, vec2 fromB, vec2 toA, vec2 toB) {
      vec2 fromAxis = fromB - fromA;
      vec2 fromNormal = normalize(vec2(-fromAxis.y, fromAxis.x));
      vec2 toAxis = toB - toA;
      vec2 toNormal = normalize(vec2(-toAxis.y, toAxis.x));
      float along = dot(p - fromA, fromAxis) / dot(fromAxis, fromAxis);
      vec2 mapped = toA + along * toAxis + dot(p - fromA, fromNormal) * toNormal;
      float distanceToBone = length(p - mix(fromA, fromB, clamp(along, 0., 1.)));
      return vec3(mapped, distanceToBone);
    }

    vec3 mapLeg(vec2 p, int src, int next, float t) {
      vec2 h = mix(hip[src], hip[next], t);
      vec2 k = mix(knee[src], knee[next], t);
      vec2 a = mix(ankle[src], ankle[next], t);
      vec3 thigh = mapSegment(p, h, k, hip[src], knee[src]);
      vec3 shin = mapSegment(p, k, a, knee[src], ankle[src]);
      float shinWeight = smoothstep(k.y - .045, k.y + .045, p.y);
      return vec3(mix(thigh.xy, shin.xy, shinWeight), min(thigh.z, shin.z));
    }

    vec2 walkPoint(int src, int next, float t) {
      vec3 nearLeg = mapLeg(uv, src * 2, next * 2, t);
      vec3 farLeg = mapLeg(uv, src * 2 + 1, next * 2 + 1, t);
      float useNear = smoothstep(-.018, .018, farLeg.z - nearLeg.z);
      float weight = smoothstep(.46, .60, uv.y) * (1. - smoothstep(.09, .17, min(nearLeg.z, farLeg.z)));
      return mix(uv, mix(farLeg.xy, nearLeg.xy, useNear), weight);
    }

    void main(){
      vec2 pointA = uv, pointB = uv;
      if (frames.x < 4. && frames.y < 4. && frames.z > 0.) {
        pointA = walkPoint(int(frames.x), int(frames.y), frames.z);
        pointB = walkPoint(int(frames.y), int(frames.x), 1. - frames.z);
      }
      vec4 a=samplePose(frames.x,pointA),b=samplePose(frames.y,pointB);float alpha=mix(a.a,b.a,frames.z);
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
