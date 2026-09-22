import React from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const buyTicketsOp = spring({ frame, fps, config: { damping: 100 } });
  const turnUpOp = spring({ frame: frame - 45, fps, config: { damping: 100 } });
  
  const buyTicketsY = spring({ frame, fps, from: 50, to: 0, config: { damping: 14 } });
  const turnUpY = spring({ frame: frame - 45, fps, from: 50, to: 0, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "80px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <h1 
          className="cinzel"
          style={{ 
            fontSize: "140px", 
            margin: 0, 
            opacity: buyTicketsOp,
            transform: `translateY(${buyTicketsY}px)`,
            lineHeight: 1.1
          }}
        >
          Buy tickets.
        </h1>
        <h1 
          className="cinzel ember-gradient"
          style={{ 
            fontSize: "140px", 
            margin: 0, 
            opacity: turnUpOp,
            transform: `translateY(${turnUpY}px)`,
            lineHeight: 1.1,
            paddingBottom: "20px"
          }}
        >
          Turn up.
        </h1>
      </div>
    </AbsoluteFill>
  );
};
