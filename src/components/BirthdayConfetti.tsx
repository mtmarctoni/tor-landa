"use client";

import { useReducedMotion } from "framer-motion";

export default function BirthdayConfetti() {
  const reducedMotion = useReducedMotion();
  if (reducedMotion) return null;
  return (
    <div aria-hidden="true" className="birthday-confetti">
      {Array.from({ length: 12 }, (_, index) => (
        <i
          key={index}
          style={{
            left: `${(index * 17 + 5) % 100}%`,
            animationDelay: `${index * 0.09}s`,
            background: ["#f7bc61", "#3cc8bd", "#f58b89"][index % 3],
          }}
        />
      ))}
    </div>
  );
}
