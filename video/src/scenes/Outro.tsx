import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoY = spring({ frame, fps, from: 50, to: 0, config: { damping: 14 } });
  const logoOp = spring({ frame, fps, config: { damping: 14 } });
  
  const textOp = spring({ frame: frame - 45, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "80px", textAlign: "center" }}>
      <h1 
        className="cinzel ember-gradient"
        style={{ 
          fontSize: "160px", 
          margin: "0 0 40px 0", 
          transform: `translateY(${logoY}px)`,
          opacity: logoOp,
          filter: "drop-shadow(0 0 40px rgba(168, 56, 10, 0.5))",
          paddingBottom: "20px"
        }}
      >
        TixNaija
      </h1>
      <p style={{ fontSize: "50px", opacity: textOp, fontWeight: 500, lineHeight: 1.4 }}>
        Because turning up shouldn't be stressful.
      </p>
    </AbsoluteFill>
  );
};
