import { motion, AnimatePresence } from "motion/react";

interface SuccessCheckmarkProps {
  show: boolean;
  size?: number;
}

/**
 * Animated SVG checkmark with a drawing circle + checkmark stroke.
 * Used by both the OTP and Payment demo pages for consistent success feedback.
 */
export function SuccessCheckmark({ show, size = 80 }: SuccessCheckmarkProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.15, 1], opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex items-center justify-center"
        >
          <svg
            width={size}
            height={size}
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_20px_oklch(0.65_0.2_145/0.4)]"
          >
            {/* Circle */}
            <circle
              cx="28"
              cy="28"
              r="26"
              stroke="oklch(0.65 0.2 145)"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
              style={{
                strokeDasharray: 166,
                strokeDashoffset: 166,
                animation: "checkmark-circle-draw 0.6s ease-out 0.1s forwards",
              }}
            />
            {/* Checkmark path */}
            <path
              d="M17 28.5L24 35.5L39 20.5"
              stroke="oklch(0.65 0.2 145)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{
                strokeDasharray: 48,
                strokeDashoffset: 48,
                animation: "checkmark-path-draw 0.4s ease-out 0.5s forwards",
              }}
            />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
