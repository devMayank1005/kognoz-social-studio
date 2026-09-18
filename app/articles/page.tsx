import { ArticlesView } from "./ArticlesView";

// The long-form writer, which used to be reachable only from inside Studio's
// "Article Cover" format panel. Same component, now with a door of its own.
export default function ArticlesPage() {
  return <ArticlesView />;
}
