import * as THREE from 'three';

// World-space waves keep the sea continuous across the waterfront blocks.
export function createWater(color,sky){
 return new THREE.ShaderMaterial({
  uniforms:{seaColor:{value:new THREE.Color(color)},skyMap:{value:sky}},
  vertexShader:`varying vec3 waterPosition;
   void main(){vec4 world=modelMatrix*vec4(position,1.0);waterPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`uniform vec3 seaColor;uniform sampler2D skyMap;varying vec3 waterPosition;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
   void main(){
    vec2 p=waterPosition.xz;
    p+=vec2(noise(p*.27),noise(p*.31+8.))*2.5;
    float a=sin(p.x*2.2+p.y*1.4+noise(p*.8)*4.),b=sin(p.x*1.8-p.y*3.1),c=sin(p.x*5.1+p.y*4.4);
    vec3 normal=normalize(vec3(a*.085+b*.06,1.0,b*.075+c*.04));
    vec3 eye=normalize(cameraPosition-waterPosition),reflection=reflect(-eye,normal);
    vec2 uv=vec2(atan(reflection.z,reflection.x)*.15915494+.5,asin(clamp(reflection.y,-1.0,1.0))*.31830989+.5);
    vec3 reflected=texture2D(skyMap,uv).rgb;
    float fresnel=.015+.1*pow(1.0-max(dot(normal,eye),0.0),5.0);
    float depth=clamp((waterPosition.x-90.0)/65.0,0.0,1.0);
    float patches=noise(p*.55)*.65+noise(p*1.4)*.35;
    vec3 base=mix(vec3(.006,.28,.32),seaColor,depth*.55+.2)*(.8+patches*.55+.045*a+.025*b);
    vec3 halfVector=normalize(eye+normalize(vec3(60.0,55.0,-35.0)));
    float sparkle=pow(max(dot(normal,halfVector),0.0),220.0)*smoothstep(.7,.88,noise(p*5.0));
    gl_FragColor=vec4(mix(base,reflected,fresnel)+vec3(1.0,.96,.77)*sparkle*.18,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`,
  side:THREE.DoubleSide,
 });
}
