import { Composition } from "remotion";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import React from 'react';

// Brand Tokens
const TOKENS = {
  primary: 'oklch(0.66 0.22 40)',
  bg: '#22201e',
  text: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.08)',
  font: 'system-ui, sans-serif'
};

export const MyComponent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animations
  const logoIn = spring({ frame, fps, config: { damping: 14 } });
  
  // Scene 2 & 3 triggers
  const s2Frame = frame - 90; // starts at 3s
  const s3Frame = frame - 240; // starts at 8s
  const s4Frame = frame - 360; // starts at 12s

  const phoneUp = spring({ frame: s2Frame, fps, config: { damping: 12 } });
  const scannerSweep = interpolate(s3Frame, [0, 60], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease)
  });
  
  const checkBadge = spring({ frame: s3Frame - 60, fps, config: { tension: 200 } });
  
  const outroScale = spring({ frame: s4Frame, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: TOKENS.bg, color: TOKENS.text, fontFamily: TOKENS.font }}>
      
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 800, height: 800,
        background: TOKENS.primary,
        borderRadius: '50%',
        filter: 'blur(200px)',
        opacity: Math.sin(frame / 20) * 0.15 + 0.15
      }} />

      {/* SCENE 1: The Hook (0 - 3s) */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ 
            transform: `translateY(${50 - logoIn * 50}px) scale(${logoIn})`,
            opacity: logoIn,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30
          }}>
            <h1 style={{ fontSize: 120, fontWeight: 900, margin: 0, textShadow: `0 0 50px ${TOKENS.primary}` }}>
              TixNaija
            </h1>
            <h2 style={{ fontSize: 50, fontWeight: 500, margin: 0, opacity: 0.9 }}>
              Your events. In your pocket.
            </h2>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 2 & 3: Phone Mockup (3s - 12s) */}
      <Sequence from={90} durationInFrames={270}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            width: 800, height: 1600,
            transform: `translateY(${400 - phoneUp * 400}px) scale(0.85)`,
            background: '#111',
            borderRadius: 80,
            border: `12px solid #333`,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: `0 30px 100px rgba(0,0,0,0.5)`
          }}>
            
            {/* Dashboard Mockup (3s - 8s) */}
            <Sequence from={0} durationInFrames={150}>
              <div style={{ padding: 60 }}>
                <h1 style={{ fontSize: 70, marginBottom: 40 }}>Dashboard</h1>
                <div style={{ background: TOKENS.glass, height: 200, borderRadius: 30, marginBottom: 40 }} />
                <div style={{ background: TOKENS.glass, height: 200, borderRadius: 30, marginBottom: 40 }} />
                <div style={{ 
                  background: TOKENS.primary, 
                  height: 150, 
                  borderRadius: 75,
                  display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                  <span style={{ fontSize: 50, fontWeight: 'bold' }}>Scan Tickets</span>
                </div>
              </div>
            </Sequence>

            {/* Scanner UI (8s - 12s) */}
            <Sequence from={150}>
              <AbsoluteFill style={{ background: '#000', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{
                  width: 500, height: 500,
                  border: `6px solid ${TOKENS.primary}`,
                  borderRadius: 40,
                  position: 'relative'
                }}>
                  {/* Laser */}
                  <div style={{
                    position: 'absolute',
                    top: `${scannerSweep}%`,
                    left: 0, width: '100%', height: 4,
                    background: TOKENS.primary,
                    boxShadow: `0 0 20px ${TOKENS.primary}`
                  }} />
                  
                  <div style={{
                    position: 'absolute', top: '10%', left: '10%', width: '80%', height: '80%',
                    background: 'repeating-linear-gradient(45deg, #fff, #fff 10px, transparent 10px, transparent 20px)',
                    opacity: 0.2
                  }} />
                </div>

                {/* Valid Badge */}
                <div style={{
                  position: 'absolute', top: '70%',
                  transform: `scale(${checkBadge})`,
                  background: '#22c55e',
                  padding: '20px 60px',
                  borderRadius: 50,
                  boxShadow: '0 10px 40px rgba(34, 197, 94, 0.4)'
                }}>
                  <span style={{ fontSize: 60, fontWeight: 'bold' }}>✅ Ticket Valid</span>
                </div>
              </AbsoluteFill>
            </Sequence>

          </div>
          
          <h2 style={{ position: 'absolute', bottom: 150, fontSize: 60, fontWeight: 700 }}>
            {frame < 240 ? "Manage seamlessly." : "Scan in seconds."}
          </h2>
        </AbsoluteFill>
      </Sequence>

      {/* SCENE 4: Outro (12s - 16s) */}
      <Sequence from={360}>
        <AbsoluteFill style={{ 
          backgroundColor: TOKENS.bg,
          justifyContent: 'center', alignItems: 'center',
          transform: `scale(${outroScale})`,
          opacity: outroScale
        }}>
           <h1 style={{ fontSize: 130, fontWeight: 900, margin: 0, color: TOKENS.primary }}>TixNaija</h1>
           <h2 style={{ fontSize: 60, marginTop: 40, marginBottom: 80 }}>Download today.</h2>
           
           <div style={{ display: 'flex', gap: 40 }}>
             <div style={{ padding: '30px 60px', background: TOKENS.glass, borderRadius: 20, fontSize: 40, border: '2px solid rgba(255,255,255,0.1)' }}>
               App Store
             </div>
             <div style={{ padding: '30px 60px', background: TOKENS.glass, borderRadius: 20, fontSize: 40, border: '2px solid rgba(255,255,255,0.1)' }}>
               Google Play
             </div>
           </div>
        </AbsoluteFill>
      </Sequence>

    </AbsoluteFill>
  );
};

export const MyComposition = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={480}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
