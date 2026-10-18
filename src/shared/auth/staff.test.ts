import { describe, expect, it } from 'vitest';
import { parseStaffAccess } from './staff';
describe('server-provided staff access',()=>{
    it('accepts only known roles with the corresponding school scope',()=>{
        for(const role of ['master','forum']) expect(parseStaffAccess({role,schoolName:null})).toEqual({role,schoolName:null});
        for(const role of ['school','teacher']) expect(parseStaffAccess({role,schoolName:'SDN SATU'})).toEqual({role,schoolName:'SDN SATU'});
    });
    it('rejects role coercion, missing memberships, and empty or global scopes for school staff',()=>{
        for(const value of [null,[],{},'master',{role:['master'],schoolName:null},{role:'student',schoolName:null},
            {role:'school',schoolName:null},{role:'school',schoolName:3},{role:'teacher',schoolName:'   '},
            {role:'master',schoolName:'SDN SATU'},{role:'forum'}]) expect(()=>parseStaffAccess(value)).toThrow();
    });
});
