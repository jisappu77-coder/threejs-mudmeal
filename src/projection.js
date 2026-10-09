// The supplied waterfront artwork bends beyond the bakery. Keep simulation coordinates
// stable while applying the same continuous world projection to scenery and moving actors.
export function waterfrontBend(y){const t=Math.max(0,Math.min(150,y-70));return .0011*t*t;}
export function renderPoint(p,phase){return phase===1?[p[0]+waterfrontBend(-p[2]),p[1],p[2]]:p;}
export function renderHeading(heading,y,phase){if(phase!==1)return heading;const slope=y>70&&y<220?.0022*(y-70):0;return Math.atan2(Math.sin(heading)+slope*Math.cos(heading),Math.cos(heading));}
export function projectWaterfront(root,objects){
 root.updateMatrixWorld(true);
 for(const o of root.children){
  if(o.isInstancedMesh){const m=o.matrix.clone();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.elements[12]+=waterfrontBend(-m.elements[14]);o.setMatrixAt(i,m)}o.instanceMatrix.needsUpdate=true;o.computeBoundingBox();o.computeBoundingSphere();}
  else if(o.isMesh){if(!o.matrixWorld.equals(root.matrixWorld)){o.geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);o.position.set(0,0,0);o.rotation.set(0,0,0);o.scale.set(1,1,1);o.matrixAutoUpdate=true;}const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setX(i,p.getX(i)+waterfrontBend(-p.getZ(i)));p.needsUpdate=true;o.geometry.computeVertexNormals();o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}
  else{o.position.x+=waterfrontBend(-o.position.z);o.rotation.y-=renderHeading(0,-o.position.z,1);}
 }
 for(const o of objects)if(o.renderedRect){const [a,b,c,d]=o.renderedRect,origin=o.origin||[0,0];o.renderedRect=[a+waterfrontBend(b+origin[1]),b,c+waterfrontBend(d+origin[1]),d];}
}
