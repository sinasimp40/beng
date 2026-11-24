import { useMemo } from "react";
import { useTheme } from "@/lib/theme";

export function ParticleBackground() {
  const { theme } = useTheme();
  
  const particles = useMemo(() => {
    const count = 200;
    return Array.from({ length: count }, (_, i) => {
      const size = Math.random() * 4 + 2;
      const left = Math.random() * 100;
      const startTop = Math.random() * 150 + 20;
      const delay = Math.random() * 8;
      const duration = Math.random() * 10 + 8;
      const opacity = Math.random() * 0.7 + 0.3;
      
      return {
        id: i,
        size,
        left,
        startTop,
        delay,
        duration,
        opacity,
      };
    });
  }, []);

  // Dark mode: white dots on black background
  // Light mode: black dots on white background
  const particleColor = theme === "dark" ? "255, 255, 255" : "0, 0, 0";

  return (
    <>
      <style>{`
        @keyframes particleFloat {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-150vh);
          }
        }
      `}</style>
      <div 
        className="fixed inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              top: `${particle.startTop}%`,
              backgroundColor: `rgba(${particleColor}, ${particle.opacity})`,
              boxShadow: `0 0 ${particle.size}px rgba(${particleColor}, 0.5)`,
              animation: `particleFloat ${particle.duration}s linear ${particle.delay}s infinite`,
            }}
          />
        ))}
      </div>
    </>
  );
}
