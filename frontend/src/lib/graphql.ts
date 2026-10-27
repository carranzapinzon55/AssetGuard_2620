import { GraphQLClient } from "graphql-request";
import { readSession } from "@/lib/auth";

const endpoint = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "/api/graphql";

export function createGraphQLClient(token = readSession()?.token): GraphQLClient {
  return new GraphQLClient(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        fullName
        email
        role
        status
      }
    }
  }
`;