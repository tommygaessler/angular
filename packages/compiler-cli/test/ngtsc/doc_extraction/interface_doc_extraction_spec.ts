/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {DocEntry} from '@angular/compiler-cli/src/ngtsc/docs';
import {EntryType, InterfaceEntry, MemberTags, MemberType, MethodEntry, PropertyEntry} from '@angular/compiler-cli/src/ngtsc/docs/src/entities';
import {runInEachFileSystem} from '@angular/compiler-cli/src/ngtsc/file_system/testing';
import {loadStandardTestFiles} from '@angular/compiler-cli/src/ngtsc/testing';

import {NgtscTestEnvironment} from '../env';

const testFiles = loadStandardTestFiles({fakeCore: true, fakeCommon: true});

runInEachFileSystem(() => {
  let env!: NgtscTestEnvironment;

  describe('ngtsc interface docs extraction', () => {
    beforeEach(() => {
      env = NgtscTestEnvironment.setup(testFiles);
      env.tsconfig();
    });

    it('should extract interfaces', () => {
      env.write('index.ts', `
        export interface UserProfile {}

        export interface CustomSlider {}
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');
      expect(docs.length).toBe(2);
      expect(docs[0].name).toBe('UserProfile');
      expect(docs[0].entryType).toBe(EntryType.Interface);
      expect(docs[1].name).toBe('CustomSlider');
      expect(docs[1].entryType).toBe(EntryType.Interface);
    });

    it('should extract interface members', () => {
      env.write('index.ts', `
        export interface UserProfile {
          firstName(): string;
          age: number;
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');
      const interfaceEntry = docs[0] as InterfaceEntry;
      expect(interfaceEntry.members.length).toBe(2);

      const methodEntry = interfaceEntry.members[0] as MethodEntry;
      expect(methodEntry.memberType).toBe(MemberType.Method);
      expect(methodEntry.name).toBe('firstName');
      expect(methodEntry.returnType).toBe('string');

      const propertyEntry = interfaceEntry.members[1] as PropertyEntry;
      expect(propertyEntry.memberType).toBe(MemberType.Property);
      expect(propertyEntry.name).toBe('age');
      expect(propertyEntry.type).toBe('number');
    });

    it('should extract a method with a rest parameter', () => {
      env.write('index.ts', `
        export interface UserProfile {            
          getNames(prefix: string, ...ids: string[]): string[];
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');
      const interfaceEntry = docs[0] as InterfaceEntry;
      const methodEntry = interfaceEntry.members[0] as MethodEntry;
      const [prefixParamEntry, idsParamEntry] = methodEntry.params;

      expect(prefixParamEntry.name).toBe('prefix');
      expect(prefixParamEntry.type).toBe('string');
      expect(prefixParamEntry.isRestParam).toBe(false);

      expect(idsParamEntry.name).toBe('ids');
      expect(idsParamEntry.type).toBe('string[]');
      expect(idsParamEntry.isRestParam).toBe(true);
    });

    it('should extract interface method params', () => {
      env.write('index.ts', `
        export interface UserProfile {
          setPhone(num: string, area?: string): void;
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');

      const interfaceEntry = docs[0] as InterfaceEntry;
      expect(interfaceEntry.members.length).toBe(1);

      const methodEntry = interfaceEntry.members[0] as MethodEntry;
      expect(methodEntry.memberType).toBe(MemberType.Method);
      expect(methodEntry.name).toBe('setPhone');
      expect(methodEntry.params.length).toBe(2);

      const [numParam, areaParam] = methodEntry.params;
      expect(numParam.name).toBe('num');
      expect(numParam.isOptional).toBe(false);
      expect(numParam.type).toBe('string');

      expect(areaParam.name).toBe('area');
      expect(areaParam.isOptional).toBe(true);
      expect(areaParam.type).toBe('string | undefined');
    });

    it('should not extract private interface members', () => {
      env.write('index.ts', `
        export interface UserProfile {
            private ssn: string;
            private getSsn(): string;
            private static printSsn(): void;
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');

      const interfaceEntry = docs[0] as InterfaceEntry;
      expect(interfaceEntry.members.length).toBe(0);
    });

    it('should extract member tags', () => {
      // Test both properties and methods with zero, one, and multiple tags.
      env.write('index.ts', `
        export interface UserProfile {
            eyeColor: string;
            protected name: string;
            readonly age: number;
            address?: string;
            static country: string;
            protected readonly birthday: string;
            
            getEyeColor(): string;
            protected getName(): string;
            getAge?(): number;
            static getCountry(): string;
            protected getBirthday?(): string;
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');

      const interfaceEntry = docs[0] as InterfaceEntry;
      expect(interfaceEntry.members.length).toBe(11);

      const [
        eyeColorMember,
        nameMember,
        ageMember,
        addressMember,
        countryMember,
        birthdayMember,
        getEyeColorMember,
        getNameMember,
        getAgeMember,
        getCountryMember,
        getBirthdayMember,
      ] = interfaceEntry.members;

      // Properties
      expect(eyeColorMember.memberTags.length).toBe(0);
      expect(nameMember.memberTags).toEqual([MemberTags.Protected]);
      expect(ageMember.memberTags).toEqual([MemberTags.Readonly]);
      expect(addressMember.memberTags).toEqual([MemberTags.Optional]);
      expect(countryMember.memberTags).toEqual([MemberTags.Static]);
      expect(birthdayMember.memberTags).toContain(MemberTags.Protected);
      expect(birthdayMember.memberTags).toContain(MemberTags.Readonly);

      // Methods
      expect(getEyeColorMember.memberTags.length).toBe(0);
      expect(getNameMember.memberTags).toEqual([MemberTags.Protected]);
      expect(getAgeMember.memberTags).toEqual([MemberTags.Optional]);
      expect(getCountryMember.memberTags).toEqual([MemberTags.Static]);
      expect(getBirthdayMember.memberTags).toContain(MemberTags.Protected);
      expect(getBirthdayMember.memberTags).toContain(MemberTags.Optional);
    });

    it('should extract getters and setters', () => {
      // Test getter-only, a getter + setter, and setter-only.
      env.write('index.ts', `
        export interface UserProfile {            
          get userId(): number;
          
          get userName(): string;
          set userName(value: string);
          
          set isAdmin(value: boolean);
        }
      `);

      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');
      const interfaceEntry = docs[0] as InterfaceEntry;
      expect(interfaceEntry.entryType).toBe(EntryType.Interface);

      expect(interfaceEntry.members.length).toBe(4);

      const [userIdGetter, userNameGetter, userNameSetter, isAdminSetter, ] = interfaceEntry.members;

      expect(userIdGetter.name).toBe('userId');
      expect(userIdGetter.memberType).toBe(MemberType.Getter);
      expect(userNameGetter.name).toBe('userName');
      expect(userNameGetter.memberType).toBe(MemberType.Getter);
      expect(userNameSetter.name).toBe('userName');
      expect(userNameSetter.memberType).toBe(MemberType.Setter);
      expect(isAdminSetter.name).toBe('isAdmin');
      expect(isAdminSetter.memberType).toBe(MemberType.Setter);
    });
  });
});
