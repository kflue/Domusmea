import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { financeRoutes } from './finance.routes';

@Component({ template: '' })
class Stub {}

describe('financeRoutes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'finance', children: financeRoutes },
          { path: 'subscriptions', component: Stub },
          { path: 'subscriptions/:id', component: Stub },
        ]),
      ],
    });
  });

  it.each([
    ['/finance/subscriptions', '/subscriptions'],
    ['/finance/subscriptions/new', '/subscriptions/new'],
    ['/finance/subscriptions/42', '/subscriptions/42'],
  ])('redirects the old address %s to %s', async (from, to) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(from);
    expect(TestBed.inject(Router).url).toBe(to);
  });
});
