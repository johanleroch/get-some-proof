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
 * Six answers, readable at once: a disclosure list would hide the words a
 * visitor came to check and keep them out of the page for a crawler. The
 * title runs the full width here and the questions sit in two columns under
 * it, so the section does not repeat the split every other one uses.
 */
export function LandingFaq() {
  return (
    <LandingSection id="faq" labelledBy="faq-title">
      <SectionTitle className="max-w-[16ch]" id="faq-title">
        Frequently asked questions
      </SectionTitle>
      <dl className="mt-12 grid gap-x-14 gap-y-8 sm:grid-cols-2">
        {questions.map((item) => (
          <div className="border-line border-t pt-5" key={item.question}>
            <dt className="type-subheading text-ink">{item.question}</dt>
            <dd className="type-body text-ink-2 mt-2 max-w-[46ch]">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </LandingSection>
  );
}
