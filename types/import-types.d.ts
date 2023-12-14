declare module "*.scss" {
	const content: string;
	export default content;
}

declare module "*.json" {
	const content: string;
	export default content;
}

declare module "*.gql" {
	import { DocumentNode } from "graphql";
	const Schema: DocumentNode;

	export = Schema;
}
