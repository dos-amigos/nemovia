"use client";

import React from "react";
import { motion } from "motion/react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 20, stiffness: 200 },
  },
};

interface StaggerGridProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerGrid({
  children,
  className = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
}: StaggerGridProps) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.1 }}
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
