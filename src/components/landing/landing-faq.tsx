import { LandingSection, SectionTitle } from "./landing-primitives";

const questions = [
  {
    answer:
      "No. They can open your collection link and submit a testimonial without signing up.",
    question: "Do my customers need an account?",
  },
  {
    answer:
      "Yes. They can record a video in their browser or upload an existing video file. They can also choose to write a text testimonial.",
    question: "Can customers record a video directly?",
  },
  {
    answer:
      "No. You review incoming testimonials and decide which ones become public.",
    question: "Are testimonials published automatically?",
  },
  {
    answer:
      "Create your Widget in the Studio, then copy its embed code into your website. Your website needs to support custom HTML and scripts.",
    question: "How do I add testimonials to my website?",
  },
  {
    answer: "Yes. Each Widget has its own selection, order and appearance.",
    question: "Can I show different testimonials on different pages?",
  },
  {
    answer:
      "Yes. The Free plan includes collection limits and a Get Some Proof promotion card on public displays.",
    question: "Can I start for free?",
  },
] as const;

/**
 * Six answers, all of them readable at once. A disclosure list would hide
 * the words a visitor came to check and would keep them out of the page for
 * a crawler; the questions are short enough to read as a list.
 */
export function LandingFaq() {
  return (
    <LandingSection id="faq" labelledBy="faq-title" tone="quiet">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="min-w-0 lg:col-span-4">
          <SectionTitle className="lg:sticky lg:top-24" id="faq-title">
            Frequently asked questions
          </SectionTitle>
        </div>
        <dl className="grid min-w-0 gap-x-10 gap-y-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
          {questions.map((item) => (
            <div className="border-line border-t pt-5" key={item.question}>
              <dt className="type-subheading text-ink">{item.question}</dt>
              <dd className="type-body text-ink-2 mt-2 max-w-[46ch]">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </LandingSection>
  );
}
