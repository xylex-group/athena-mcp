export function jsonContent(data: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function textContent(text: string): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text", text }],
  };
}

export function errorContent(text: string): {
  isError: true;
  content: [{ type: "text"; text: string }];
} {
  return {
    isError: true,
    content: [{ type: "text", text }],
  };
}
