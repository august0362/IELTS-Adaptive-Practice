import { db } from "./client";
import { seedDatabase } from "./seed";

seedDatabase(db)
  .then(({ skillCount, partCount, questionTypeCount, configCount }) => {
    console.log(
      `Seed complete: ${skillCount} skills, ${partCount} parts, ${questionTypeCount} question types, ${configCount} config defaults.`
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
