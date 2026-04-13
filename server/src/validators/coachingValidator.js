const { z } = require("zod");

const phoneSchema = z
  .string()
  .trim()
  .min(6, "Phone number too short")
  .max(20, "Phone number too long")
  .regex(
    /^(\+?\d{1,4}[\s-]?)?(\(?\d{2,5}\)?[\s-]?)?\d{4,10}$/,
    "Invalid phone number format"
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email format");

const contactSchema = z
  .string()
  .trim()
  .min(1, "Contact cannot be empty")
  .max(100, "Contact must be under 100 characters");

const coachingInstituteSchema = z.object({
  name: z
    .string({ required_error: "Institute name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(200, "Name must be under 200 characters"),
  address: z
    .string()
    .trim()
    .max(500, "Address must be under 500 characters")
    .optional()
    .default(""),
  phones: z.array(phoneSchema).optional().default([]),
  emails: z.array(emailSchema).optional().default([]),
  contacts: z.array(contactSchema).optional().default([]),
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
      z.enum(["coaching", "tutoring", "test_prep", "skill_training"], {
        errorMap: () => ({
          message: "Type must be coaching, tutoring, test_prep or skill_training",
        }),
      })
    )
    .min(1, "At least one type is required")
    .default(["coaching"]),
});

const updateCoachingInstituteSchema = coachingInstituteSchema.partial();

const saveCoachingInstitutesSchema = z.object({
  areaId: z
    .string({ required_error: "Area ID is required" })
    .min(1, "Area ID is required"),
  institutes: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name is required"),
        address: z.string().trim().default(""),
        phones: z.array(z.string().trim()).default([]),
        emails: z.array(z.string().trim()).default([]),
        contacts: z.array(z.string().trim()).default([]),
        website: z.string().trim().default(""),
        types: z.array(z.string()).default(["coaching"]),
      })
    )
    .min(1, "At least one institute is required"),
});

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
  validateCoachingInstitute: validate(coachingInstituteSchema),
  validateUpdateCoachingInstitute: validate(updateCoachingInstituteSchema),
  validateSaveCoachingInstitutes: validate(saveCoachingInstitutesSchema),
};
