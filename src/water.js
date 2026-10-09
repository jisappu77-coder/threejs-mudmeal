import * as THREE from 'three';

// World-space waves keep the sea continuous across the waterfront blocks.
export function createWater(color,sky){
 return new THREE.ShaderMaterial({
  uniforms:{seaColor:{value:new THREE.Color(color)},skyMap:{value:sky}},
  vertexShader:`varying vec3 waterPosition;
   void main(){vec4 world=modelMatrix*vec4(position,1.0);waterPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform vec3 seaColor;uniform sampler2D skyMap;varying vec3 waterPosition;
   void main(){
    vec2 p=waterPosition.xz;
    p+=vec2(sin(p.y*.37),cos(p.x*.29))*1.3;
    float a=sin(p.x*2.2+p.y*1.4),b=sin(p.x*1.8-p.y*3.1),c=sin(p.x*5.1+p.y*4.4);
    vec3 normal=normalize(vec3(a*.14+b*.085,1.0,b*.11+c*.07));
    vec3 eye=normalize(cameraPosition-waterPosition),reflection=reflect(-eye,normal);
    vec2 uv=vec2(atan(reflection.z,reflection.x)*.15915494+.5,asin(clamp(reflection.y,-1.0,1.0))*.31830989+.5);
    vec3 reflected=texture2D(skyMap,uv).rgb;
    float fresnel=.03+.16*pow(1.0-max(dot(normal,eye),0.0),3.0);
    float depth=clamp((waterPosition.x-81.0)/65.0,0.0,1.0);
    vec3 base=mix(vec3(.005,.24,.23),seaColor,depth)*(.95+.13*a+.08*b);
    vec3 halfVector=normalize(eye+normalize(vec3(60.0,55.0,-35.0)));
    float sparkle=pow(max(dot(normal,halfVector),0.0),90.0);
    gl_FragColor=vec4(mix(base,reflected,fresnel)+vec3(1.0,.96,.77)*sparkle*.7,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
  side:THREE.DoubleSide,
 });
}
