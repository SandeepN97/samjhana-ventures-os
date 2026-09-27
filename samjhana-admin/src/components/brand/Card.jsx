import React from 'react';

/** The standard white content card used on every admin screen. */
export default function Card({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`rounded-xl bg-white p-4 shadow-sm ${className}`} {...props}>
      {children}
    </Tag>
  );
}
