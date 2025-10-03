uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uZoom;
uniform float uFeather;
varying vec2 vWorld;

void main(){
	vec2 uv = vWorld / uResolution;
	vec2 cUV = uCenter / uResolution;
	vec2 delta = uv - cUV;
	vec2 sampleUV = cUV + delta / uZoom;
	// sample magnified
	vec4 mag = texture2D(uTexture, sampleUV);
	// sample original
	vec4 orig = texture2D(uTexture, uv);
	// simple smooth edge based on distance to center (normalized)
	float dist = length(delta) / (max(uResolution.x, uResolution.y));
	float edge = smoothstep(uFeather, 0.0, dist);
	gl_FragColor = mix(orig, mag, edge);
}
