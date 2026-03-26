const { z } = require("zod");

// Phone: Indian (+91) or general, stripped of spaces
const phoneSchema = z
  .string()
  .trim()
  .min(6, "Phone number too short")
  .max(20, "Phone number too long")
  .regex(
    /^(\+?\d{1,4}[\s-]?)?(\(?\d{2,5}\)?[\s-]?)?\d{4,10}$/,
    "Invalid phone number format"
  );

// Email
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format");

// Contact person (name / designation)
const contactSchema = z
  .string()
  .trim()
  .min(1, "Contact cannot be empty")
  .max(100, "Contact must be under 100 characters");

const institutionSchema = z.object({
  name: z
    .string({ required_error: "Institution name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be under 200 characters"),
  address: z
    .string()
    .trim()
    .max(500, "Address must be under 500 characters")
    .optional()
    .default(""),
  phones: z
    .array(phoneSchema)
    .optional()
    .default([]),
  emails: z
    .array(emailSchema)
    .optional()
    .default([]),
  contacts: z
    .array(contactSchema)
    .optional()
    .default([]),
  website: z
    .string()
    .trim()
    .max(300, "Website must be under 300 characters")
    .refine(
      (val) =>
        !val ||
        val === "" ||
        val.startsWith("http://") ||
        val.startsWith("https://"),
      { message: "Website must start with http:// or https://" }
    )
    .optional()
    .default(""),
  types: z
    .array(
      z.enum(["school", "college", "polytechnic", "iti"], {
        errorMap: () => ({
          message: "Type must be school, college, polytechnic or iti",
        }),
      })
    )
    .min(1, "At least one type is required")
    .default(["school"]),
});

const updateInstitutionSchema = institutionSchema.partial();

const saveInstitutionsSchema = z.object({
  areaId: z
    .string({ required_error: "Area ID is required" })
    .min(1, "Area ID is required"),
  institutions: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name is required"),
        address: z.string().trim().default(""),
        phones: z.array(z.string().trim()).default([]),
        emails: z.array(z.string().trim()).default([]),
        contacts: z.array(z.string().trim()).default([]),
        contact: z.string().trim().optional().default(""), // legacy single field
        website: z.string().trim().default(""),
        types: z.array(z.string()).default(["school"]),
      })
    )
    .min(1, "At least one institution is required"),
});

// Middleware factory
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return res.status(400).json({
        success: false,
        message: errors[0].message,
        errors,
      });
    }
    req.body = result.data;
    next();
  };
}

module.exports = {
  validateInstitution: validate(institutionSchema),
  validateUpdateInstitution: validate(updateInstitutionSchema),
  validateSaveInstitutions: validate(saveInstitutionsSchema),
};
