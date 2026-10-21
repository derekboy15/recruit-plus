<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<gameSystem id="sys-1" name="Mini System" revision="1" xmlns="http://www.battlescribe.net/schema/gameSystemSchema">
  <profileTypes>
    <profileType id="pt-unit" name="Unit"/>
    <profileType id="pt-weapon" name="Weapon"/>
  </profileTypes>
  <categoryEntries>
    <categoryEntry id="cat-troops" name="Troops" hidden="false"/>
    <categoryEntry id="cat-core" name="Core" hidden="true">
      <modifiers>
        <modifier type="set" field="name" value="Core Units"/>
      </modifiers>
    </categoryEntry>
  </categoryEntries>
  <forceEntries>
    <forceEntry id="force-patrol" name="Patrol Detachment" hidden="false">
      <forceEntries>
        <forceEntry id="force-nested" name="Nested Force" hidden="false"/>
      </forceEntries>
      <categoryLinks>
        <categoryLink id="fcl-troops" name="Troops" hidden="false" targetId="cat-troops" primary="false">
          <constraints>
            <constraint field="selections" scope="parent" value="1.0" percentValue="false" shared="true" includeChildSelections="false" includeChildForces="false" id="c-f-troops" type="min"/>
          </constraints>
        </categoryLink>
      </categoryLinks>
    </forceEntry>
  </forceEntries>
  <sharedRules>
    <rule id="rule-obsec" name="Objective Secured" hidden="false">
      <description>Counts as more models &amp; holds objectives.</description>
    </rule>
  </sharedRules>
</gameSystem>
