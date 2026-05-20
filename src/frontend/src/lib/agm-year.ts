import type { CheckIn, Registration, Shareholder } from "@/types";
import { RegistrationType, ShareholderStatus } from "@/types";
import { parseRegistrationNotes } from "@/pages/registration/registration-form-utils";

export function getRegistrationAgmYear(registration: Registration): string {
  const notes = parseRegistrationNotes(registration.notes);
  return notes["AGM Year"] ?? "";
}

export function filterRegistrationsByYear(
  registrations: Registration[],
  year: string,
) {
  return registrations.filter((registration) => getRegistrationAgmYear(registration) === year);
}

export function filterCheckInsByRegistrations(
  checkIns: CheckIn[],
  registrations: Registration[],
) {
  const registrationIds = new Set(registrations.map((registration) => registration.id));
  return checkIns.filter((checkIn) => registrationIds.has(checkIn.registrationId));
}

export function deriveYearSpecificStatus(
  shareholderId: string,
  registrations: Registration[],
  checkIns: CheckIn[],
): ShareholderStatus {
  const registration = registrations.find((item) => item.shareholderId === shareholderId);
  if (!registration) return ShareholderStatus.NotRegistered;
  const hasCheckIn = checkIns.some((item) => item.registrationId === registration.id);
  if (hasCheckIn) return ShareholderStatus.CheckedIn;
  return registration.registrationType === RegistrationType.Proxy
    ? ShareholderStatus.RegisteredProxy
    : ShareholderStatus.RegisteredInPerson;
}

export function buildYearScopedShareholders(
  shareholders: Shareholder[],
  registrations: Registration[],
  checkIns: CheckIn[],
) {
  return shareholders.map((shareholder) => ({
    ...shareholder,
    status: deriveYearSpecificStatus(shareholder.id, registrations, checkIns),
  }));
}
