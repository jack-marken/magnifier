uniform vec2 uResolution;
varying vec2 vWorld;
void main(){
	// position is in local mesh coords; compute world position in pixels
	vec4 worldPos = modelMatrix * vec4(position, 1.0);
	vWorld = worldPos.xy;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
