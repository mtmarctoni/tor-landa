/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Prevent circular dependencies",
      from: {},
      to: { circular: true },
    },
    {
      name: "utils-no-imports-from-higher",
      severity: "error",
      comment: "utils/ cannot import from components, sections, or services",
      from: { path: "^src/utils/" },
      to: {
        path: ["^src/components/", "^src/sections/", "^src/services/"],
      },
    },
    {
      name: "types-no-imports",
      severity: "error",
      comment: "types/ cannot import from any other src layer",
      from: { path: "^src/types/" },
      to: {
        path: ["^src/(components|sections|services|utils|hooks|context|data)/"],
      },
    },
  ],
};
