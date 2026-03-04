import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TopBarComponent } from './top-bar.component';

describe('TopBarComponent visual states', () => {
  let fixture: ComponentFixture<TopBarComponent>;
  let component: TopBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TopBarComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TopBarComponent);
    component = fixture.componentInstance;
    component.siteTitle = 'Operator';
    component.loggedInLabel = 'roy';
    component.mockLabel = true;
    component.previewLabel = 'preview-user';
    component.previewPersist = true;
    component.canSwitchUniverse = true;
    component.currentUniverseName = 'Main Universe';
    component.universes = [
      { id: 'u1', name: 'Main Universe' },
      { id: 'u2', name: 'Second Universe' },
    ];
    component.activeUniverseId = 'u1';
  });

  it('renders all status badges when flags are enabled', () => {
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('.topbar__badge');
    expect(badges.length).toBe(4);
  });

  it('shows phone controls and phone classes in phone mode', () => {
    component.phoneMode = true;
    component.showTime = true;
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('#topbar-header');
    const navButton = fixture.nativeElement.querySelector('.topbar__nav');
    expect(header.classList.contains('topbar--phone')).toBe(true);
    expect(navButton).toBeTruthy();
  });

  it('renders universe menu items when menu is open', () => {
    component.universeMenuOpen = true;
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.universe-menu__item');
    expect(items.length).toBe(2);
  });
});
