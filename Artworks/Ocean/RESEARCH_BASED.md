# Research-Based Ocean Shader Implementation

## Papers and Techniques Used

### 1. **Gerstner Waves** (Tessendorf "Simulating Ocean Water", SIGGRAPH 2001)
- **Implementation**: Proper Gerstner wave function with horizontal displacement
- **Why**: More realistic than simple sine waves - creates proper wave crests and troughs
- **Key Feature**: Horizontal displacement creates "choppy" waves naturally

### 2. **Wave Dispersion Relation**
- **Formula**: `w = sqrt(g * k)` where g = gravity, k = wave number
- **Implementation**: `getWaveSpeed()` function computes speed from frequency
- **Why**: Physically accurate - waves of different frequencies move at correct speeds

### 3. **Proper Fresnel Calculation**
- **Implementation**: Schlick's approximation with correct IOR (1.33 for water)
- **Why**: Determines reflection vs refraction ratio based on viewing angle
- **Physical Accuracy**: Uses actual water-air interface IOR

### 4. **Beer-Lambert Law for Absorption**
- **Formula**: `I = I0 * exp(-μ * d)` where μ = absorption coefficient
- **Implementation**: `absorption = exp(-waterAbsorption * depth)`
- **Why**: Realistic depth darkening - red light absorbed more than blue

### 5. **Subsurface Scattering**
- **Implementation**: Approximate subsurface scattering based on back-lighting
- **Why**: Water scatters light internally - creates realistic glow in shallow areas

### 6. **Cook-Torrance BRDF**
- **Implementation**: Full microfacet BRDF with GGX distribution
- **Why**: Physically accurate specular highlights

## Key Improvements Over Previous Version

### ✅ **Gerstner Waves Instead of Sine Waves**
- Creates proper wave shape with horizontal displacement
- More realistic wave motion
- Natural choppy appearance

### ✅ **Physical Wave Dispersion**
- Waves move at correct speeds based on frequency
- Follows oceanographic physics
- More natural wave interaction

### ✅ **Proper Water Color Model**
- Deep water: Dark blue (0.0, 0.15, 0.3)
- Shallow water: Turquoise (0.0, 0.4, 0.6)
- Smooth transition based on depth

### ✅ **Correct Absorption**
- Only affects refracted light (what you see through water)
- Reflections remain bright
- Realistic depth darkening

### ✅ **Subsurface Scattering**
- Light penetrates water and scatters
- Creates realistic glow in shallow areas
- Adds depth and realism

### ✅ **Better Sky Model**
- Includes sun disk
- Proper gradient
- Realistic environment for reflections

## Physical Parameters

### Wave Parameters
- **12 waves** with varied directions
- **Amplitudes**: 0.8m to 0.08m (realistic ocean range)
- **Frequencies**: 0.3 to 3.2 rad/m
- **Speeds**: Computed from dispersion relation

### Water Properties
- **IOR**: 1.33 (physically accurate)
- **Absorption**: vec3(0.15, 0.045, 0.015) m^-1 (realistic values)
- **Roughness**: 0.005 (very smooth ocean surface)

### Lighting
- **Sun intensity**: 2.5 (bright, realistic)
- **Proper Fresnel**: View-angle dependent reflection
- **Subsurface scattering**: Realistic light penetration

## Expected Visual Quality

With this implementation, you should see:

1. **Realistic Wave Motion**
   - Proper wave crests and troughs
   - Natural choppy appearance
   - Correct wave speeds

2. **Proper Reflections**
   - Bright reflections at grazing angles
   - Sky and sun reflected correctly
   - Fresnel-based mixing

3. **Realistic Depth**
   - Deep water appears dark blue
   - Shallow water appears turquoise
   - Smooth color transitions

4. **Subsurface Scattering**
   - Light glows through shallow water
   - Realistic light penetration
   - Adds depth perception

5. **Proper Specular Highlights**
   - Bright sun reflections
   - Anisotropic highlights
   - Physically accurate

## References

1. **Tessendorf, J.** "Simulating Ocean Water" - SIGGRAPH 2001
   - Gerstner wave model
   - Wave spectrum generation

2. **Hoffman, N. & Preetham, A.J.** "Rendering Outdoor Light Scattering in Real Time"
   - Sky model
   - Atmospheric scattering

3. **Cook & Torrance** "A Reflectance Model for Computer Graphics"
   - Microfacet BRDF
   - Physically-based rendering

4. **Schlick, C.** "An Inexpensive BRDF Model for Physically-based Rendering"
   - Fresnel approximation
   - Efficient computation

5. **Oceanographic Data**
   - Wave dispersion relation
   - Water absorption coefficients
   - Realistic wave parameters

## Testing Checklist

- [ ] Waves move at correct speeds
- [ ] Reflections are bright at grazing angles
- [ ] Deep water appears dark blue
- [ ] Shallow water appears turquoise
- [ ] Sun creates bright specular highlights
- [ ] No blocky artifacts
- [ ] Smooth wave motion
- [ ] Proper depth darkening

This implementation is based on established research and should produce photorealistic ocean water.
