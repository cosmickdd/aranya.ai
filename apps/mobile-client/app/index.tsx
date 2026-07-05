import { Redirect } from 'expo-router';

export default function Index() {
  // Simple redirect to the onboarding flow
  return <Redirect href="/onboarding" />;
}
