// The supplied waterfront artwork bends beyond the bakery. Keep simulation coordinates
// stable while applying the same continuous world projection to scenery and moving actors.
export function waterfrontBend(y){const t=Math.max(0,Math.min(150,y-70));return .0011*t*t;}
export function waterfrontShift(x,y){return waterfrontBend(y)*Math.max(0,Math.min(1,(x+15)/15));}
export function renderPoint(p,phase){return phase===1?[p[0]+waterfrontShift(p[0],-p[2]),p[1],p[2]]:p;}
export function renderHeading(heading,y,phase,x=0){if(phase!==1||x<=-15)return heading;const weight=Math.max(0,Math.min(1,(x+15)/15)),slope=y>70&&y<220?.0022*(y-70):0,stretch=x<0?waterfrontBend(y)/15:0;return Math.atan2((1+stretch)*Math.sin(heading)+weight*slope*Math.cos(heading),Math.cos(heading));}
export function projectWaterfront(root,objects){
 root.updateMatrixWorld(true);
 for(const o of root.children){
  if(o.isInstancedMesh){const m=o.matrix.clone();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.elements[12]+=waterfrontShift(m.elements[12],-m.elements[14]);o.setMatrixAt(i,m)}o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();}
  else if(o.isMesh){if(!o.matrixWorld.equals(root.matrixWorld)){o.geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.matrixAutoUpdate=true;}const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+waterfrontShift(p.getX(i),-p.getZ(i)));p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}
  else{const x=o.position.x;o.position.x+=waterfrontShift(x,-o.position.z);o.rotation.y-=renderHeading(0,-o.position.z,1,x);}
 }
 for(const o of objects)if(o.renderedRect){const [a,b,c,d]=o.renderedRect,origin=o.origin||[0,0];o.renderedRect=[a+waterfrontShift(a+origin[0],b+origin[1]),b,c+waterfrontShift(c+origin[0],d+origin[1]),d];}
}
