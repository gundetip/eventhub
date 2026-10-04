import { test, expect } from '@playwright/test';

function getTestConfig() {
  const baseURL = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
  const email = process.env.E2E_TEST_EMAIL || 'rahulshetty1@gmail.com';
  const password = process.env.E2E_TEST_PASSWORD || 'Magiclife1!';

  if (
    new URL(baseURL).hostname === 'eventhub.rahulshettyacademy.com' &&
    process.env.PLAYWRIGHT_ALLOW_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'Refusing to run write-capable tests against production without PLAYWRIGHT_ALLOW_PRODUCTION=true.',
    );
  }

  return { baseURL, email, password };
}

async function login(page, config) {
  await page.goto(`${config.baseURL}/login`);
  await page.getByPlaceholder('you@email.com').fill(config.email);
  await page.getByLabel('Password').fill(config.password);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

async function createBooking(page, baseURL, onBookingCreated) {
  await page.goto(`${baseURL}/bookings`);
  const existingCards = page.getByTestId('booking-card');
  await expect(page.getByRole('heading', { name: 'My Bookings' })).toBeVisible();
  await expect.poll(async () => (
    await existingCards.count() > 0 ||
    await page.getByText('No bookings yet', { exact: true }).count() > 0
  )).toBe(true);

  if (await existingCards.count() >= 9) {
    throw new Error('Refusing to create a booking because the test account is already at its 9-booking limit.');
  }

  await page.goto(`${baseURL}/events`);
  const eventCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(eventCard).toBeVisible();

  const eventTitle = (await eventCard.locator('h3').innerText()).trim();
  await eventCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  const customerEmail = `eventhub-e2e-${Date.now()}@example.com`;
  await page.getByLabel('Full Name').fill('EventHub E2E User');
  await page.locator('#customer-email').fill(customerEmail);
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  const [bookingResponse] = await Promise.all([
    page.waitForResponse((response) => (
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/api/bookings')
    )),
    page.getByRole('button', { name: 'Confirm Booking' }).click(),
  ]);
  if (!bookingResponse.ok()) {
    throw new Error(`Booking request failed with HTTP ${bookingResponse.status()}.`);
  }

  const bookingRef = (await bookingResponse.json())?.data?.bookingRef;
  if (!bookingRef) {
    throw new Error('Booking response did not include a booking reference for cleanup.');
  }
  onBookingCreated(bookingRef);

  const reference = page.locator('.booking-ref').first();
  await expect(reference).toHaveText(bookingRef);

  return {
    bookingRef,
    eventTitle,
    customerEmail,
  };
}

async function cancelCreatedBooking(page, baseURL, bookingRef) {
  if (!bookingRef) return;

  await page.goto(`${baseURL}/bookings`);
  const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
  if (await card.count() === 0) return;

  await card.getByRole('button', { name: 'Cancel Booking' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expect(card).toHaveCount(0);
}

async function readBookingField(page, label) {
  const text = await page.getByText(label, { exact: true }).locator('..').innerText();
  return text.split('\n').slice(1).join(' ').trim();
}

test.describe('Booking Flow — first three strategy E2E scenarios', () => {
  test('TC-001: shows the created booking on the bookings list', async ({ page }) => {
    const config = getTestConfig();
    let bookingRef;

    try {
      await login(page, config);
      const booking = await createBooking(page, config.baseURL, (ref) => { bookingRef = ref; });

      await page.goto(`${config.baseURL}/bookings`);
      const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });

      await expect(card).toBeVisible();
      await expect(card).toContainText(booking.eventTitle);
      await expect(card).toContainText('confirmed');
      await expect(card).toContainText('1 ticket');
      await expect(card).toContainText(/\$\s?\d/);
    } finally {
      await cancelCreatedBooking(page, config.baseURL, bookingRef);
    }
  });

  test('TC-002: shows booking, event, customer, and payment details', async ({ page }) => {
    const config = getTestConfig();
    let bookingRef;

    try {
      await login(page, config);
      const booking = await createBooking(page, config.baseURL, (ref) => { bookingRef = ref; });

      await page.goto(`${config.baseURL}/bookings`);
      const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
      await card.getByRole('link', { name: 'View Details' }).click();
      await expect(page).toHaveURL(/\/bookings\/\d+/);

      const bookingId = new URL(page.url()).pathname.split('/').pop();
      await expect(page.getByText(bookingRef, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Event Details' })).toBeVisible();
      await expect(page.getByText(booking.eventTitle, { exact: true }).first()).toBeVisible();

      for (const label of ['Category', 'Date', 'Venue', 'City']) {
        await expect(page.getByText(label, { exact: true })).toBeVisible();
        expect(await readBookingField(page, label)).not.toBe('');
        expect(await readBookingField(page, label)).not.toBe('—');
      }

      await expect(page.getByRole('heading', { name: 'Customer Details' })).toBeVisible();
      await expect(page.getByText('EventHub E2E User', { exact: true })).toBeVisible();
      await expect(page.getByText(booking.customerEmail, { exact: true })).toBeVisible();
      await expect(page.getByText('9876543210', { exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Payment Summary' })).toBeVisible();
      await expect(page.getByText('Tickets', { exact: true })).toBeVisible();
      await expect(page.getByText('Price per ticket', { exact: true })).toBeVisible();
      await expect(page.getByText('Total Paid', { exact: true })).toBeVisible();
      expect(await readBookingField(page, 'Tickets')).toBe('1');
      expect(await readBookingField(page, 'Price per ticket')).toBe(await readBookingField(page, 'Total Paid'));
      await expect(page.getByText('Booking ID', { exact: true })).toBeVisible();
      await expect(page.getByText(`#${bookingId}`, { exact: true })).toBeVisible();
      await expect(page.locator('#check-refund-btn')).toBeVisible();
    } finally {
      await cancelCreatedBooking(page, config.baseURL, bookingRef);
    }
  });

  test('TC-003: cancels a booking from its detail page', async ({ page }) => {
    const config = getTestConfig();
    let bookingRef;

    try {
      await login(page, config);
      const booking = await createBooking(page, config.baseURL, (ref) => { bookingRef = ref; });

      await page.goto(`${config.baseURL}/bookings`);
      const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
      await card.getByRole('link', { name: 'View Details' }).click();
      await expect(page).toHaveURL(/\/bookings\/\d+/);

      await page.getByRole('button', { name: 'Cancel Booking' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Cancel this booking?')).toBeVisible();
      await dialog.getByRole('button', { name: 'Yes, cancel it' }).click();

      await expect(page).toHaveURL(`${config.baseURL}/bookings`);
      await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
      await expect(
        page.getByTestId('booking-card').filter({ hasText: bookingRef }),
      ).toHaveCount(0);
    } finally {
      await cancelCreatedBooking(page, config.baseURL, bookingRef);
    }
  });
});
