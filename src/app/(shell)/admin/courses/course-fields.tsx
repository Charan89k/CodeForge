import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  title?: string;
  slug?: string;
  subtitle?: string | null;
  description?: string;
  category?: string | null;
  level?: string;
  estimatedHours?: number;
  outcomes?: string[];
  prerequisites?: string[];
  featured?: boolean;
  license?: string | null;
  attribution?: string | null;
};

const label = "text-sm font-medium";

/** The same fields for creating and editing a course. */
export function CourseFields({ values = {} }: { values?: Values }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor="course-title" className={label}>
          Title
        </label>
        <Input
          id="course-title"
          name="title"
          required
          maxLength={120}
          defaultValue={values.title}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="course-slug" className={label}>
          Slug
        </label>
        <Input
          id="course-slug"
          name="slug"
          required
          maxLength={80}
          defaultValue={values.slug}
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="course-subtitle" className={label}>
          Subtitle
        </label>
        <Input
          id="course-subtitle"
          name="subtitle"
          maxLength={200}
          defaultValue={values.subtitle ?? ""}
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="course-description" className={label}>
          Description
        </label>
        <Textarea
          id="course-description"
          name="description"
          required
          maxLength={4000}
          defaultValue={values.description}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="course-category" className={label}>
          Category
        </label>
        <Input
          id="course-category"
          name="category"
          required
          maxLength={60}
          placeholder="Programming"
          defaultValue={values.category ?? ""}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="course-level" className={label}>
            Level
          </label>
          <NativeSelect
            id="course-level"
            name="level"
            defaultValue={values.level ?? "BEGINNER"}
            className="mt-1 w-full"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </NativeSelect>
        </div>
        <div>
          <label htmlFor="course-hours" className={label}>
            Hours
          </label>
          <Input
            id="course-hours"
            name="estimatedHours"
            type="number"
            min={0}
            max={1000}
            defaultValue={values.estimatedHours ?? 0}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label htmlFor="course-outcomes" className={label}>
          Learning outcomes, one per line
        </label>
        <Textarea
          id="course-outcomes"
          name="outcomes"
          defaultValue={values.outcomes?.join("\n")}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="course-prerequisites" className={label}>
          Prerequisites, one per line
        </label>
        <Textarea
          id="course-prerequisites"
          name="prerequisites"
          defaultValue={values.prerequisites?.join("\n")}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="course-license" className={label}>
          Licence, if not written for Tech Epitome
        </label>
        <Input
          id="course-license"
          name="license"
          maxLength={120}
          defaultValue={values.license ?? ""}
          className="mt-1"
        />
      </div>
      <div>
        <label htmlFor="course-attribution" className={label}>
          Attribution
        </label>
        <Input
          id="course-attribution"
          name="attribution"
          maxLength={2000}
          defaultValue={values.attribution ?? ""}
          className="mt-1"
        />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={values.featured ?? false}
        />
        Feature this course in the library
      </label>
    </div>
  );
}
